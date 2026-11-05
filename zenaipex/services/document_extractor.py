"""
Zenaipex AI — Document Extractor Service.

Provides reusable modular functions to extract clean, normalized text
from PDFs, DOCX, Markdown, Text, and tabular files.
"""
import logging
import re
import ipaddress
import socket
import hashlib
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

class NeedsOCRError(Exception):
    """Exception raised when a document is scanned/image-only and requires OCR."""
    pass

def sanitize_characters(text: str) -> str:
    """
    Sanitize character encoding artifacts, smart quotes, and unprintable glyphs.
    Converts Windows-1252/Unicode artifacts to clean standard representations.
    """
    if not text:
        return ""
    
    # Replace unicode replacement character and common broken quote encodings
    text = text.replace('\ufffd', '"')
    
    # Normalize curly/smart quotes and apostrophes
    text = re.sub(r'[\u201c\u201d\u201e\u201f\x93\x94]', '"', text)
    text = re.sub(r'[\u2018\u2019\u201a\u201b\x91\x92]', "'", text)
    
    # Normalize dashes and hyphens
    text = re.sub(r'[\u2013\u2014\u2015\x96\x97]', '-', text)
    
    # Normalize bullet characters to standard dash bullet
    text = re.sub(r'[\u2022\u2023\u25e6\u2043\u2219]', '• ', text)
    
    # Normalize multiple whitespace within lines (preserve newlines)
    text = re.sub(r'[ \t\r\f\v]+', ' ', text)
    
    # Clean non-printable control characters except standard whitespace
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    
    return text

def normalize_extracted_text(text: str) -> str:
    """
    Clean and normalize extracted text.
    Preserves all single newlines so semantic chunker can parse line-by-line.
    """
    text = sanitize_characters(text)
    
    # Remove trailing/leading whitespaces on each line but keep the line breaks
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)
    
    # Clean repetitive footers like 'Page X of Y' or standalone page numbers
    text = re.sub(r'(?i)\bpage\s+\d+\s+of\s+\d+\b', '', text)
    # Horizontal rules are layout separators, not knowledge-bearing content.
    text = re.sub(r'(?m)^\s*-{3,}\s*$\n?', '', text)
    
    # Replace 3 or more consecutive newlines with exactly 2 newlines (paragraph break)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def extract_txt_text(file_path: str) -> Optional[str]:
    """Extract text from plain TXT, CSV, or Markdown file."""
    try:
        with open(file_path, "rb") as f:
            content_bytes = f.read()
        try:
            return normalize_extracted_text(content_bytes.decode("utf-8"))
        except UnicodeDecodeError:
            try:
                return normalize_extracted_text(content_bytes.decode("utf-8-sig"))
            except UnicodeDecodeError:
                return normalize_extracted_text(content_bytes.decode("latin-1", errors="replace"))
    except Exception as e:
        logger.error(f"Failed to extract text from {file_path}: {e}")
        return None

def _has_meaningful_text(text: Optional[str]) -> bool:
    """Check if extracted text has genuine readable content beyond page markers and whitespace."""
    if not text:
        return False
    clean = re.sub(r'---PAGE\s+\d+---', '', text)
    clean = re.sub(r'[\s\-_=*~•|#]+', '', clean)
    return len(clean) >= 50

def _extract_pdf_with_gemini(file_path: str) -> Optional[str]:
    """Use Gemini Multimodal File API for fast, ultra-accurate OCR on scanned/image PDFs."""
    import os
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        try:
            from dotenv import load_dotenv
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            load_dotenv(os.path.join(base_dir, ".env"))
            api_key = os.environ.get("GEMINI_API_KEY")
        except Exception:
            pass
    if not api_key:
        logger.warning("Gemini OCR skipped: GEMINI_API_KEY is not set.")
        return None

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        logger.info(f"Uploading scanned PDF {file_path} to Gemini File API for OCR...")
        uploaded = client.files.upload(file=file_path)
        try:
            prompt = (
                "You are an expert OCR and document digitization engine. "
                "Extract all readable text, modules, tables, procedures, and descriptions "
                "from this entire document into comprehensive Markdown with ---PAGE X--- markers. "
                "Be thorough, preserve all headings, tables, numbers, and bullet points, and do not omit any content."
            )
            for model_name in ["gemini-3.5-flash-lite", "gemini-3.8-flash"]:
                try:
                    logger.info(f"Extracting OCR text with {model_name}...")
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[uploaded, prompt],
                        config=types.GenerateContentConfig(
                            max_output_tokens=65536
                        )
                    )
                    if response and response.text:
                        logger.info(f"Gemini OCR successfully extracted {len(response.text)} chars using {model_name}.")
                        return response.text
                except Exception as model_err:
                    logger.warning(f"Gemini model {model_name} OCR failed: {model_err}")
                    continue
            return None
        finally:
            try:
                client.files.delete(name=uploaded.name)
            except Exception as del_err:
                logger.debug(f"Failed to delete uploaded temp file {uploaded.name}: {del_err}")
    except Exception as e:
        logger.warning(f"Gemini OCR failed for {file_path}: {e}")
        return None

def extract_pdf_text(file_path: str) -> Optional[str]:
    """
    Extract readable text from a PDF file.
    Prefers PyMuPDF (fitz) for superior layout and character accuracy,
    falling back to PyPDF2, pypdfium2, and Gemini AI OCR for scanned/image PDFs.
    """
    # Attempt 1: PyMuPDF (fitz)
    try:
        import pymupdf  # type: ignore
        text_parts = []
        doc = pymupdf.open(file_path)
        if len(doc) == 0:
            raise ValueError("PDF is empty (0 pages).")
        
        for i, page in enumerate(doc):
            page_text = page.get_text("text") or ""
            text_parts.append(f"\n\n---PAGE {i+1}---\n\n")
            text_parts.append(page_text)
            
        doc.close()
        final_text = normalize_extracted_text("\n\n".join(text_parts))
        if _has_meaningful_text(final_text):
            return final_text
    except ImportError:
        pass
    except Exception as mupdf_err:
        logger.warning(f"PyMuPDF extraction failed on {file_path}: {mupdf_err}. Falling back to PyPDF2.")

    # Attempt 2: PyPDF2 fallback
    try:
        from PyPDF2 import PdfReader
        text_parts = []
        with open(file_path, "rb") as f:
            reader = PdfReader(f)
            if reader.is_encrypted:
                raise ValueError("PDF is password protected and cannot be read.")
            if len(reader.pages) == 0:
                raise ValueError("PDF is empty (0 pages).")
            for i, page in enumerate(reader.pages):
                text_parts.append(f"\n\n---PAGE {i+1}---\n\n")
                text_parts.append(page.extract_text() or "")
                
        final_text = normalize_extracted_text("\n\n".join(text_parts))
        if _has_meaningful_text(final_text):
            return final_text
    except Exception as pypdf_err:
        logger.warning(f"PyPDF2 extraction failed on {file_path}: {pypdf_err}.")

    # Attempt 3: pypdfium2 fallback
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(file_path)
        if len(pdf) > 0:
            parts = []
            for i, page in enumerate(pdf):
                tp = page.get_textpage()
                t = tp.get_text_range() or ""
                parts.append(f"\n\n---PAGE {i+1}---\n\n")
                parts.append(t)
            final_text = normalize_extracted_text("\n\n".join(parts))
            if _has_meaningful_text(final_text):
                return final_text
    except Exception as pdfium_err:
        logger.debug(f"pypdfium2 textpage extraction skipped on {file_path}: {pdfium_err}")

    # Attempt 4: Cloud AI OCR via Gemini Document API
    try:
        gemini_ocr_text = _extract_pdf_with_gemini(file_path)
        if gemini_ocr_text and _has_meaningful_text(gemini_ocr_text):
            return normalize_extracted_text(gemini_ocr_text)
    except Exception as ocr_err:
        logger.warning(f"Gemini OCR attempt failed on {file_path}: {ocr_err}")

    # Attempt 5: Local Tesseract OCR (if available)
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(file_path)
        ocr_parts = []
        for i, page in enumerate(pdf):
            img = page.render(scale=1.5).to_pil()
            ocr_parts.append(f"\n\n---PAGE {i+1}---\n\n")
            ocr_parts.append(pytesseract.image_to_string(img, config="--psm 6"))
        local_ocr_text = normalize_extracted_text("\n\n".join(ocr_parts))
        if _has_meaningful_text(local_ocr_text):
            return local_ocr_text
    except Exception as tesseract_err:
        logger.debug(f"Local tesseract OCR unavailable: {tesseract_err}")

    # No selectable text and OCR unavailable
    raise NeedsOCRError("Could not extract sufficient selectable text from this PDF. OCR is required for image-only/scanned PDFs.")

def extract_docx_text(file_path: str) -> Optional[str]:
    """Extract paragraphs and tables from a DOCX file using python-docx."""
    try:
        import docx
        doc = docx.Document(file_path)
        text_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text.strip())
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    text_parts.append(row_text)
        return normalize_extracted_text("\n\n".join(text_parts))
    except ImportError:
        logger.error("python-docx is not installed.")
        return None
    except Exception as e:
        logger.error(f"Failed to extract DOCX text from {file_path}: {e}")
        return None

def extract_text(file_path: str, filename: str, content_type: str = "") -> str:
    """
    Route extraction to the appropriate handler based on filename or MIME type.
    Returns the clean extracted text or raises ValueError if extraction fails.
    """
    filename_lower = filename.lower()
    content_type_lower = content_type.lower()
    
    text = None
    if filename_lower.endswith(".pdf") or "pdf" in content_type_lower:
        text = extract_pdf_text(file_path)
    elif filename_lower.endswith(".docx") or "officedocument.wordprocessingml" in content_type_lower:
        text = extract_docx_text(file_path)
    elif any(filename_lower.endswith(ext) for ext in [".txt", ".md", ".csv", ".json", ".markdown"]) or "text/" in content_type_lower:
        text = extract_txt_text(file_path)
    else:
        text = extract_txt_text(file_path)
        
    if not text:
        raise ValueError(f"Could not extract text from {filename}. File may be empty, unsupported, or corrupted.")
        
    return text

import asyncio
from bs4 import BeautifulSoup
import logging

@dataclass
class CrawlOptions:
    max_pages: int = 20
    max_depth: int = 3
    include_subdomains: bool = True
    include_pdfs: bool = False
    follow_sitemap: bool = False
    include_patterns: list[str] = field(default_factory=list)
    exclude_patterns: list[str] = field(default_factory=list)

    def normalized(self) -> "CrawlOptions":
        return CrawlOptions(
            max_pages=max(1, min(int(self.max_pages or 20), 100)),
            max_depth=max(0, min(int(self.max_depth or 3), 10)),
            include_subdomains=bool(self.include_subdomains),
            include_pdfs=bool(self.include_pdfs),
            follow_sitemap=bool(self.follow_sitemap),
            include_patterns=[str(x).strip() for x in (self.include_patterns or []) if str(x).strip()],
            exclude_patterns=[str(x).strip() for x in (self.exclude_patterns or []) if str(x).strip()],
        )

def _extract_url_text_sync(url: str, crawl_options: Optional[CrawlOptions] = None, return_report: bool = False):
    """Synchronous worker that runs Playwright/Requests to deep-crawl up to 10 pages of the same domain."""
    from playwright.sync_api import sync_playwright
    import requests
    from urllib.parse import urlparse, urljoin, urldefrag
    from bs4 import BeautifulSoup
    
    options = (crawl_options or CrawlOptions()).normalized()
    parsed_start = urlparse(url)
    base_domain = (parsed_start.hostname or "").lower().removeprefix("www.")
    def safe_url(candidate: str) -> bool:
        parsed = urlparse(candidate)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return False
        try:
            addresses = socket.getaddrinfo(parsed.hostname, None)
            for address in addresses:
                ip = ipaddress.ip_address(address[4][0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                    return False
        except (ValueError, socket.gaierror, OSError):
            return False
        return True

    if not safe_url(url):
        raise ValueError("URL is not allowed. Use a public HTTP or HTTPS website.")

    def canonical(candidate: str) -> str:
        parsed = urlparse(urldefrag(candidate)[0])
        path = parsed.path.rstrip("/") or "/"
        return parsed._replace(path=path, query="", fragment="").geturl()

    url = canonical(url)
    visited_urls = set()
    seen_page_hashes = set()
    urls_to_visit = [url]
    all_extracted_text = []
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    })

    def extract_text_and_links(html_str, page_url):
        soup = BeautifulSoup(html_str, "html.parser")
        
        # Extract links
        new_links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith(('javascript:', 'mailto:', 'tel:', '#', 'viber:', 'whatsapp:')) or href.lower().endswith(('.png', '.jpg', '.zip', '.mp4')) or (href.lower().endswith('.pdf') and not options.include_pdfs):
                continue
                
            full_link = canonical(urljoin(page_url, href))
            link_domain = (urlparse(full_link).hostname or "").lower().removeprefix("www.")
            is_valid_domain = link_domain == base_domain or (options.include_subdomains and link_domain.endswith("." + base_domain))
            if not is_valid_domain or not safe_url(full_link):
                continue

            path = urlparse(full_link).path.lower()
            is_pdf = path.endswith(".pdf")
            if is_pdf and not options.include_pdfs:
                continue
            if options.include_patterns and not any(p.lower() in full_link.lower() for p in options.include_patterns):
                continue
            if any(p.lower() in full_link.lower() for p in options.exclude_patterns):
                continue
            
            if is_valid_domain and full_link not in visited_urls and full_link not in urls_to_visit:
                new_links.append(full_link)
                
        # Clean up useless tags
        for element in soup(["script", "style", "meta", "noscript", "header", "footer", "nav", "svg", "iframe"]):
            element.decompose()
            
        return soup.get_text(separator="\n"), new_links

    max_pages = options.max_pages
    pages_discovered = 1
    failed_pages = []
    
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
            page = context.new_page()

            # Playwright can follow redirects and resolve DNS independently of
            # the initial validation. Intercept every browser request so a
            # redirect/DNS-rebinding hop cannot reach a private network.
            def guard_request(route):
                if safe_url(route.request.url):
                    route.continue_()
                else:
                    route.abort("blockedbyclient")

            page.route("**/*", guard_request)
            
            if options.follow_sitemap:
                try:
                    sitemap_url = urljoin(url, "/sitemap.xml")
                    if not safe_url(sitemap_url):
                        raise ValueError("Sitemap URL is not allowed")
                    sitemap_response = session.get(sitemap_url, timeout=15, allow_redirects=False)
                    if sitemap_response.ok:
                        sitemap = BeautifulSoup(sitemap_response.text, "xml")
                        for loc in sitemap.find_all("loc"):
                            candidate = canonical(loc.get_text(strip=True))
                            candidate_domain = (urlparse(candidate).hostname or "").lower().removeprefix("www.")
                            if candidate_domain == base_domain or (options.include_subdomains and candidate_domain.endswith("." + base_domain)):
                                if candidate not in urls_to_visit and candidate not in visited_urls:
                                    urls_to_visit.append(candidate)
                except Exception as e:
                    logger.info(f"[DEEP_CRAWLER] Sitemap unavailable: {type(e).__name__}")

            url_depths = {url: 0}
            while urls_to_visit and len(visited_urls) < max_pages:
                current_url = urls_to_visit.pop(0)
                if current_url in visited_urls:
                    continue
                    
                visited_urls.add(current_url)
                logger.info(f"[DEEP_CRAWLER] Crawling ({len(visited_urls)}/{max_pages}): {current_url}")
                
                try:
                    if current_url.lower().endswith(".pdf") and options.include_pdfs:
                        if not safe_url(current_url):
                            raise ValueError("PDF URL is not allowed")
                        pdf_response = session.get(current_url, timeout=30, allow_redirects=False)
                        from pypdf import PdfReader
                        from io import BytesIO
                        pdf_text = "\n".join((page.extract_text() or "") for page in PdfReader(BytesIO(pdf_response.content)).pages)
                        clean_text = normalize_extracted_text(pdf_text)
                        if clean_text and len(clean_text) > 20:
                            page_hash = hashlib.sha256(re.sub(r"\s+", " ", clean_text).strip().encode("utf-8")).hexdigest()
                            if page_hash not in seen_page_hashes:
                                seen_page_hashes.add(page_hash)
                                all_extracted_text.append(f"--- SOURCE URL: {current_url} ---\n{clean_text}")
                        continue

                    # Modern marketing sites keep analytics/animations open forever,
                    # so networkidle can hang and leave a stale crawl in the KB.
                    page.goto(current_url, timeout=30000, wait_until="domcontentloaded")
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1200) # Give client-rendered content time to settle
                    html_content = page.content()
                    
                    if html_content:
                        text, found_links = extract_text_and_links(html_content, current_url)
                        clean_text = normalize_extracted_text(text)
                        
                        # Only add if it has meaningful content
                        page_hash = hashlib.sha256(re.sub(r"\s+", " ", clean_text).strip().encode("utf-8")).hexdigest()
                        if clean_text and len(clean_text) > 20 and page_hash not in seen_page_hashes:
                            seen_page_hashes.add(page_hash)
                            all_extracted_text.append(f"--- SOURCE URL: {current_url} ---\n{clean_text}")
                            
                        current_depth = url_depths.get(current_url, 0)
                        for link in found_links:
                            if current_depth >= options.max_depth:
                                continue
                            if link not in visited_urls and link not in urls_to_visit:
                                urls_to_visit.append(link)
                                url_depths[link] = current_depth + 1
                                pages_discovered += 1
                except Exception as e:
                    failed_pages.append({"url": current_url, "error": type(e).__name__})
                    logger.warning(f"[DEEP_CRAWLER] Failed to crawl {current_url}: {e}")
            
            browser.close()
    except Exception as e:
        logger.error(f"[DEEP_CRAWLER] Critical failure during Playwright crawl: {e}")

    final_text = "\n\n".join(all_extracted_text)
    
    if not final_text or len(final_text) < 50:
        raise ValueError("Could not extract sufficient readable text from this URL.")
        
    if return_report:
        return {
            "text": final_text,
            "pages_discovered": max(pages_discovered, len(visited_urls)),
            "pages_scraped": len([x for x in all_extracted_text if x.strip()]),
            "pages_skipped": max(0, pages_discovered - len(visited_urls)),
            "failed_pages": failed_pages,
            "characters_extracted": len(final_text),
            "crawl_limit": max_pages,
        }
    return final_text

async def extract_url_text(url: str) -> str:
    """
    Bulletproof async wrapper for URL extraction. 
    Runs the synchronous Playwright code in a separate thread to avoid Windows/FastAPI loop conflicts.
    """
    try:
        # Run in a completely separate thread to avoid NotImplementedError on Windows asyncio subprocess
        return await asyncio.to_thread(_extract_url_text_sync, url)
    except Exception as e:
        logger.error(f"Failed to extract text from URL {url}: {e}")
        raise ValueError(f"URL content could not be read: {str(e)}")

async def extract_url_text_with_report(url: str, crawl_options: Optional[CrawlOptions] = None) -> dict:
    """Crawl a URL and return extracted text plus transparent crawl telemetry."""
    try:
        return await asyncio.to_thread(_extract_url_text_sync, url, crawl_options, True)
    except Exception as e:
        logger.error(f"Failed to read URL report for {url}: {e}")
        raise ValueError(f"URL content could not be read: {str(e)}")

