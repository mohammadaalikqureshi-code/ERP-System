import re
from typing import Optional, Tuple


def clean_doctor_name(raw_name: Optional[str]) -> str:
    """
    Strips any leading 'Dr.', 'Dr', 'Doctor', 'dr.', case-insensitively,
    in a loop to eliminate repeated prefixes (e.g. 'Dr. Dr. Meera Raghavan' -> 'Meera Raghavan').
    """
    if not raw_name:
        return ""
    clean = raw_name.strip()
    while re.match(r'^(dr\.?|doctor)(\s+|$)', clean, flags=re.IGNORECASE):
        clean = re.sub(r'^(dr\.?|doctor)(\s+|$)', '', clean, flags=re.IGNORECASE).strip()
    return clean


def format_doctor_name(raw_name: Optional[str]) -> str:
    """
    Ensures a doctor's name is prefixed with EXACTLY ONE 'Dr.' title.
    Never produces 'Dr. Dr. Name'.
    """
    clean = clean_doctor_name(raw_name)
    return f"Dr. {clean}" if clean else "Doctor"


def split_doctor_name(raw_name: Optional[str]) -> Tuple[str, str, str]:
    """
    Returns (first_name, last_name, display_full_name).
    first_name and last_name have 'Dr.' stripped.
    display_full_name has exactly one 'Dr. ' prefix.
    """
    clean = clean_doctor_name(raw_name)
    if not clean:
        return "Doctor", "", "Doctor"
    parts = clean.split()
    first_name = parts[0]
    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    display_name = f"Dr. {clean}"
    return first_name, last_name, display_name


def index_to_token_prefix(index: int) -> str:
    """
    Converts a 0-based index to an alphabet token prefix:
    0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA', 27 -> 'AB', etc.
    """
    if index < 0:
        index = 0
    prefix = ""
    while True:
        prefix = chr(ord('A') + (index % 26)) + prefix
        index = (index // 26) - 1
        if index < 0:
            break
    return prefix

