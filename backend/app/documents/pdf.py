"""PDF rendering.

Documents are written as HTML and rendered by WeasyPrint, so changing how a
prescription looks means editing HTML and CSS — no PDF drawing code.

WeasyPrint needs system libraries (Pango, Cairo). They are installed in the
Docker image; if they are missing the error says exactly that instead of
producing a corrupt file.
"""

import logging
from html import escape
from typing import Optional

from app.core.exceptions import BaseAPIException

logger = logging.getLogger(__name__)

# One stylesheet for every document, so all of them look like they belong to
# the same clinic.
BASE_CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "DejaVu Sans", Helvetica, Arial, sans-serif; color: #1c1917; font-size: 11pt; line-height: 1.5; }
.header { border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; }
.clinic-name { font-size: 18pt; font-weight: bold; color: #0d9488; margin: 0; }
.clinic-meta { font-size: 9pt; color: #57534e; margin: 2px 0 0; }
.doc-title { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; text-align: right; margin: 0; }
.doc-meta { font-size: 9pt; color: #57534e; text-align: right; margin: 2px 0 0; }
.panel { background: #f5f5f4; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; }
.row { display: flex; gap: 24px; flex-wrap: wrap; }
.field { margin-right: 18px; font-size: 10pt; }
.field .label { color: #78716c; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4px; display: block; }
h2.section { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.6px; color: #0d9488; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; margin: 18px 0 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
th { background: #f5f5f4; text-align: left; padding: 7px 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.4px; color: #57534e; border-bottom: 1px solid #e7e5e4; }
td { padding: 7px 8px; border-bottom: 1px solid #f5f5f4; font-size: 10pt; vertical-align: top; }
td.num, th.num { text-align: right; }
.totals { margin-left: auto; width: 46%; }
.totals td { border: none; padding: 3px 8px; }
.totals tr.grand td { border-top: 1.5px solid #1c1917; font-weight: bold; font-size: 12pt; padding-top: 7px; }
.flag { color: #b91c1c; font-weight: bold; }
.footer { margin-top: 26px; border-top: 1px solid #e7e5e4; padding-top: 8px; font-size: 8.5pt; color: #78716c; }
.signature { margin-top: 40px; text-align: right; font-size: 10pt; }
.signature .line { border-top: 1px solid #1c1917; width: 200px; margin-left: auto; padding-top: 4px; }
.note { font-size: 9.5pt; color: #57534e; font-style: italic; }
"""


class PdfGenerationError(BaseAPIException):
    def __init__(self, message: str):
        super().__init__(message, code="pdf_failed", status_code=500)


def render_pdf(html: str, extra_css: Optional[str] = None) -> bytes:
    """Turn an HTML document into PDF bytes."""
    try:
        from weasyprint import CSS, HTML
    except ImportError as exc:  # pragma: no cover - depends on the host image
        logger.error("WeasyPrint is not usable", exc_info=True)
        raise PdfGenerationError(
            "PDF generation is not available on this server: WeasyPrint's system "
            "libraries (Pango/Cairo) are missing."
        ) from exc

    stylesheets = [CSS(string=BASE_CSS)]
    if extra_css:
        stylesheets.append(CSS(string=extra_css))

    try:
        return HTML(string=html).write_pdf(stylesheets=stylesheets)
    except Exception as exc:
        logger.error("PDF rendering failed", exc_info=True)
        raise PdfGenerationError("Could not generate the PDF. Please try again.") from exc


def clean(value) -> str:
    """Escape a value for inclusion in HTML, turning None into an em dash."""
    if value is None or value == "":
        return "—"
    return escape(str(value))


def money(amount, currency: str = "₹") -> str:
    try:
        return f"{currency}{float(amount):,.2f}"
    except (TypeError, ValueError):
        return f"{currency}0.00"
