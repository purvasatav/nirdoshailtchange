"""
paddle_server.py — Persistent PaddleOCR server.

Reads JSON lines from stdin, each containing: {"path": "<image_path>"}
Writes JSON lines to stdout: {"confidence": 0.91, "text": "...", "boxes": [{"text":"...", "x":10,"y":20,"width":100,"height":30,"confidence":0.9}]}
Writes errors to stderr.

The OCR engine is loaded ONCE at startup so subsequent requests are fast.
"""
import sys
import json
import logging
import os

os.environ["FLAGS_enable_pir_api"] = "0"

logging.getLogger("ppocr").setLevel(logging.ERROR)
logging.getLogger("paddle").setLevel(logging.ERROR)


def load_ocr():
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_textline_orientation=True, lang="en", enable_mkldnn=False)
        print(json.dumps({"status": "ready"}), flush=True)
        return ocr
    except Exception as e:
        print(json.dumps({"status": "unavailable", "error": str(e)}), flush=True)
        return None


def poly_to_box(poly):
    """Convert a 4-point polygon [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] to an axis-aligned box."""
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    return {
        "x": round(float(x_min), 2),
        "y": round(float(y_min), 2),
        "width": round(float(x_max - x_min), 2),
        "height": round(float(y_max - y_min), 2),
    }


def run_ocr(ocr, image_path: str) -> dict:
    result = ocr.ocr(image_path)
    extracted_text = []
    boxes = []
    overall_confidence = 0.0
    total_items = 0

    if result and len(result) > 0 and result[0] is not None:
        # Newer dictionary format (PaddleX)
        if isinstance(result[0], dict) and "rec_texts" in result[0]:
            texts = result[0]["rec_texts"]
            scores = result[0]["rec_scores"]
            polys = result[0].get("rec_polys") or result[0].get("dt_polys") or []
            for i, (text, conf) in enumerate(zip(texts, scores)):
                if text and str(text).strip():
                    extracted_text.append(str(text))
                    overall_confidence += float(conf)
                    total_items += 1
                    if i < len(polys):
                        box = poly_to_box(polys[i])
                        box["text"] = str(text)
                        box["confidence"] = float(conf)
                        boxes.append(box)
        # Older list-of-lists format: line = [poly, (text, conf)]
        elif isinstance(result[0], list):
            for line in result[0]:
                if len(line) > 1 and len(line[1]) > 1:
                    poly = line[0]
                    text = line[1][0]
                    conf = line[1][1]
                    if text and str(text).strip():
                        extracted_text.append(str(text))
                        overall_confidence += float(conf)
                        total_items += 1
                        box = poly_to_box(poly)
                        box["text"] = str(text)
                        box["confidence"] = float(conf)
                        boxes.append(box)

    avg_conf = overall_confidence / total_items if total_items > 0 else 0.0
    text_joined = " ".join(extracted_text).replace("\n", " ").replace("\r", "")
    return {"confidence": avg_conf, "text": text_joined, "boxes": boxes}


def main():
    ocr = load_ocr()
    if ocr is None:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                if req.get("ping"):
                    print(json.dumps({"pong": True}), flush=True)
                else:
                    print(json.dumps({"error": "PaddleOCR not available"}), flush=True)
            except Exception as e:
                print(json.dumps({"error": str(e)}), flush=True)
        return

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            if req.get("ping"):
                print(json.dumps({"pong": True}), flush=True)
                continue
            image_path = req.get("path", "")
            if not image_path:
                print(json.dumps({"error": "Missing 'path' field"}), flush=True)
                continue
            result = run_ocr(ocr, image_path)
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
