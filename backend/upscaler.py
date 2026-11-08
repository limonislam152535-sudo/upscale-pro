"""
Upscaler Pro - Server-Side AI Image Processing Engine
Zero client GPU/CPU load. Supports Real-ESRGAN with fallback to high-order
Lanczos-3 filter with adaptive unsharp masking and EXIF/JFIF DPI metadata injection.
"""

import io
import os
import time
from typing import Tuple, Optional
from PIL import Image, ImageFilter, ImageEnhance

# Check if Real-ESRGAN / PyTorch is available on host
HAS_REAL_ESRGAN = False
try:
    import torch
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
    HAS_REAL_ESRGAN = torch.cuda.is_available() or hasattr(torch.backends, "mps")
except ImportError:
    HAS_REAL_ESRGAN = False

class RealESRGANEngine:
    def __init__(self, device: str = "auto"):
        self.device = device
        self.model = None
        self._init_engine()

    def _init_engine(self):
        if not HAS_REAL_ESRGAN:
            return
        try:
            device_str = "cuda" if torch.cuda.is_available() else "cpu"
            model_arch = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
            model_path = os.getenv("REAL_ESRGAN_MODEL_PATH", "weights/RealESRGAN_x4plus.pth")
            if os.path.exists(model_path):
                self.model = RealESRGANer(
                    scale=4,
                    model_path=model_path,
                    model=model_arch,
                    tile=400,
                    tile_pad=10,
                    pre_pad=0,
                    half=torch.cuda.is_available(),
                    device=torch.device(device_str)
                )
        except Exception as e:
            print(f"[Engine] Real-ESRGAN initialization warning: {e}. Falling back to high-fidelity Lanczos3.")

    def upscale_image(
        self,
        input_bytes: bytes,
        scale: int = 4,
        model_mode: str = "photo-ultra",
        output_format: str = "JPEG",
        quality: int = 92,
        dpi: int = 300
    ) -> Tuple[bytes, Tuple[int, int], Tuple[int, int], int]:
        """
        Executes super-resolution upscaling and DPI metadata injection.
        Returns: (output_bytes, original_dimensions, upscaled_dimensions, processing_time_ms)
        """
        start_time = time.time()
        
        with Image.open(io.BytesIO(input_bytes)) as img:
            # Preserve color profile or convert RGBA to RGB if outputting JPEG
            format_clean = output_format.upper()
            if format_clean in ["JPG", "JPEG"]:
                format_clean = "JPEG"
                if img.mode in ("RGBA", "LA", "P"):
                    # Create clean solid background
                    bg = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
                    img = bg
                elif img.mode != "RGB":
                    img = img.convert("RGB")
            elif format_clean in ["PNG", "WEBP"]:
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA")

            orig_w, orig_h = img.size
            target_w = int(orig_w * scale)
            target_h = int(orig_h * scale)

            # Check if neural model is initialized and scale matches
            upscaled_img = None
            if self.model and scale == 4 and model_mode == "photo-ultra":
                try:
                    import numpy as np
                    np_img = np.array(img)
                    output, _ = self.model.enhance(np_img, outscale=scale)
                    upscaled_img = Image.fromarray(output)
                except Exception as ex:
                    print(f"[Engine] Real-ESRGAN inference failed, fallback to Lanczos-3: {ex}")

            if upscaled_img is None:
                # High-fidelity Lanczos-3 multi-lobe kernel
                upscaled_img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

                # Specialized post-processing per model mode
                if model_mode == "photo-ultra":
                    # Unsharp mask with radius 1.5, percent 140, threshold 3
                    upscaled_img = upscaled_img.filter(
                        ImageFilter.UnsharpMask(radius=1.5, percent=140, threshold=3)
                    )
                    # Micro-contrast and subtle vibrance
                    enhancer = ImageEnhance.Contrast(upscaled_img)
                    upscaled_img = enhancer.enhance(1.03)
                    color_enhancer = ImageEnhance.Color(upscaled_img)
                    upscaled_img = color_enhancer.enhance(1.02)

                elif model_mode == "anime-art":
                    # Sharp edge retention
                    upscaled_img = upscaled_img.filter(
                        ImageFilter.UnsharpMask(radius=2.0, percent=160, threshold=4)
                    )
                    color_enhancer = ImageEnhance.Color(upscaled_img)
                    upscaled_img = color_enhancer.enhance(1.05)

                elif model_mode == "digital-graphics":
                    upscaled_img = upscaled_img.filter(
                        ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2)
                    )

                else:  # balanced-universal
                    upscaled_img = upscaled_img.filter(
                        ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=3)
                    )

            # Export with injected DPI metadata
            out_buf = io.BytesIO()
            save_kwargs = {
                "dpi": (dpi, dpi),
                "optimize": True
            }

            if format_clean == "JPEG":
                save_kwargs["quality"] = quality
                save_kwargs["subsampling"] = 0  # 4:4:4 chroma
            elif format_clean == "PNG":
                save_kwargs["compress_level"] = 6
            elif format_clean == "WEBP":
                save_kwargs["quality"] = quality
                save_kwargs["method"] = 4

            upscaled_img.save(out_buf, format=format_clean, **save_kwargs)
            duration_ms = int((time.time() - start_time) * 1000)

            return out_buf.getvalue(), (orig_w, orig_h), (target_w, target_h), duration_ms

engine = RealESRGANEngine()
