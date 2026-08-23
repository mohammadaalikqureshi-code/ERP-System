"""HTML for the documents a clinic hands to a patient.

Each function takes plain dictionaries — not ORM objects — so a template can be
rendered and eyeballed in a test without touching the database.
"""

from datetime import datetime
from typing import Dict, List, Optional

from app.documents.pdf import clean, money


def _header(clinic: Dict, title: str, reference: str, issued_on: Optional[str] = None) -> str:
    issued = issued_on or datetime.now().strftime("%d/%m/%Y %I:%M %p")
    gst = f"<p class='clinic-meta'>GSTIN: {clean(clinic.get('gst_number'))}</p>" if clinic.get("gst_number") else ""
    reg = f"<p class='clinic-meta'>Reg: {clean(clinic.get('registration_number'))}</p>" if clinic.get("registration_number") else ""
    return f"""
    <div class="header">
      <div>
        <p class="clinic-name">{clean(clinic.get('name'))}</p>
        {f"<p class='clinic-meta' style='font-style:italic;'>{clean(clinic.get('tagline'))}</p>" if clinic.get('tagline') else ""}
        <p class="clinic-meta">{clean(clinic.get('address'))}</p>
        <p class="clinic-meta">Phone: {clean(clinic.get('phone'))} &nbsp;|&nbsp; {clean(clinic.get('email'))}</p>
        {gst}
        {reg}
      </div>
      <div>
        <p class="doc-title">{clean(title)}</p>
        <p class="doc-meta">No. {clean(reference)}</p>
        <p class="doc-meta">{clean(issued)}</p>
      </div>
    </div>
    """


def _patient_panel(patient: Dict, extra: Optional[Dict[str, str]] = None) -> str:
    fields = {
        "Patient": patient.get("full_name"),
        "Patient ID": patient.get("patient_code"),
        "Age / Sex": f"{patient.get('age') or '—'} / {patient.get('gender') or '—'}",
        "Mobile": patient.get("mobile"),
    }
    fields.update(extra or {})

    cells = "".join(
        f"<div class='field'><span class='label'>{clean(label)}</span>{clean(value)}</div>"
        for label, value in fields.items()
    )
    return f"<div class='panel'><div class='row'>{cells}</div></div>"


def prescription_html(
    clinic: Dict, patient: Dict, doctor: Dict, prescription: Dict, medicines: List[Dict]
) -> str:
    """A prescription the patient takes to a pharmacy."""
    rows = (
        "".join(
            f"""
        <tr>
          <td>{index}</td>
          <td><strong>{clean(medicine.get('medicine_name'))}</strong></td>
          <td>{clean(medicine.get('dosage'))}</td>
          <td>{clean(medicine.get('frequency'))}</td>
          <td>{clean(medicine.get('duration_days'))}</td>
          <td>{clean(medicine.get('instructions'))}</td>
        </tr>"""
            for index, medicine in enumerate(medicines, start=1)
        )
        or "<tr><td colspan='6' class='note'>No medicines prescribed.</td></tr>"
    )

    diagnosis = (
        f"<h2 class='section'>Diagnosis</h2><p>{clean(prescription.get('diagnosis'))}</p>"
        if prescription.get("diagnosis")
        else ""
    )

    notes = (
        f"<h2 class='section'>Advice</h2><p>{clean(prescription.get('notes'))}</p>"
        if prescription.get("notes")
        else ""
    )

    patient_panel = _patient_panel(patient, {
        "Doctor": doctor.get("name") or "—",
        "Department": doctor.get("department") or "",
    })

    return f"""
    <html><body>
      {_header(clinic, "Prescription", prescription.get("reference", "—"))}
      {patient_panel}

      {diagnosis}

      <h2 class="section">Rx</h2>
      <table>
        <thead>
          <tr>
            <th style="width:6%">#</th><th style="width:26%">Medicine</th>
            <th style="width:13%">Dosage</th><th style="width:13%">Frequency</th>
            <th style="width:14%">Duration</th><th>Instructions</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {notes}

      <div class="signature">
        <div class="line">{clean(doctor.get('name'))}</div>
        <div style="font-size:9pt;color:#57534e;">{clean(doctor.get('qualification'))}</div>
        <div style="font-size:8pt;color:#78716c;">{clean(doctor.get('registration_number', ''))}</div>
      </div>

      <div class="footer">
        This prescription is valid only for the named patient. Take medicines exactly as
        directed. Contact the clinic if symptoms worsen.
      </div>
    </body></html>
    """


def receipt_html(clinic: Dict, patient: Dict, bill: Dict) -> str:
    """A GST receipt for a payment with CGST/SGST split."""
    rows = (
        "".join(
            f"""
        <tr>
          <td>{index}</td>
          <td>{clean(item.get('description'))}</td>
          <td class="num">{clean(item.get('quantity'))}</td>
          <td class="num">{money(item.get('unit_price') or item.get('unitPrice') or 0)}</td>
          <td class="num">{money(item.get('amount') or 0)}</td>
        </tr>"""
            for index, item in enumerate(bill.get("line_items") or [], start=1)
        )
        or "<tr><td colspan='5' class='note'>No items.</td></tr>"
    )

    status = str(bill.get("payment_status", "")).upper()
    status_colour = "#15803d" if status == "PAID" else "#b45309"

    cgst = bill.get("cgst_amount") or 0
    sgst = bill.get("sgst_amount") or 0
    hsn = bill.get("hsn_sac_code")
    hsn_row = f"<tr><td style='font-size:8pt;color:#78716c;'>HSN/SAC: {clean(hsn)}</td><td></td></tr>" if hsn else ""

    # Show CGST/SGST split if available, otherwise show combined GST
    if cgst or sgst:
        gst_rows = f"""
        <tr><td>CGST (9%)</td><td class="num">{money(cgst)}</td></tr>
        <tr><td>SGST (9%)</td><td class="num">{money(sgst)}</td></tr>
        """
    else:
        gst_rows = f'<tr><td>GST</td><td class="num">{money(bill.get("gst_amount"))}</td></tr>'

    patient_panel = _patient_panel(patient, {
        "Payment": str(bill.get('payment_mode') or '—').upper()
    })

    return f"""
    <html><body>
      {_header(clinic, "Tax Invoice", bill.get("bill_number", "—"))}
      {patient_panel}

      <table>
        <thead>
          <tr>
            <th style="width:6%">#</th><th>Description</th>
            <th class="num" style="width:10%">Qty</th>
            <th class="num" style="width:18%">Rate</th>
            <th class="num" style="width:18%">Amount</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>

      <table class="totals">
        {hsn_row}
        <tr><td>Subtotal</td><td class="num">{money(bill.get('subtotal'))}</td></tr>
        <tr><td>Discount</td><td class="num">- {money(bill.get('discount_amount'))}</td></tr>
        {gst_rows}
        <tr class="grand"><td>Total</td><td class="num">{money(bill.get('total_amount'))}</td></tr>
      </table>

      <p style="clear:both;padding-top:8px;">
        Status: <strong style="color:{status_colour}">{clean(status)}</strong>
      </p>

      <div class="footer">
        Computer-generated invoice — no signature required. Please keep it for your records.
      </div>
    </body></html>
    """


def lab_report_html(
    clinic: Dict, patient: Dict, order: Dict, results: List[Dict], interpretation: Optional[str] = None
) -> str:
    """A diagnostic report, with out-of-range values flagged."""
    rows = (
        "".join(
            f"""
        <tr>
          <td>{clean(result.get('test_name'))}</td>
          <td class="{'flag' if result.get('is_abnormal') else ''}">
            {clean(result.get('result_value'))}{' ⚠' if result.get('is_abnormal') else ''}
            {f" <span style='font-size:8pt;font-weight:bold;color:#b91c1c;'>({result.get('flag')})</span>" if result.get('flag') and result.get('flag') != 'NORMAL' else ''}
          </td>
          <td>{clean(result.get('unit', ''))}</td>
          <td>{clean(result.get('normal_range') or result.get('reference_range', ''))}</td>
          <td>{clean(result.get('remarks'))}</td>
        </tr>"""
            for result in results
        )
        or "<tr><td colspan='5' class='note'>No results recorded.</td></tr>"
    )

    interpretation_block = (
        f"<h2 class='section'>Interpretation</h2><p class='note'>{clean(interpretation)}</p>"
        if interpretation
        else ""
    )

    patient_panel = _patient_panel(patient, {
        "Referred by": order.get("doctor_name") or "—",
        "Status": str(order.get("status", "")).replace("_", " ").title(),
    })

    return f"""
    <html><body>
      {_header(clinic, "Laboratory Report", order.get("reference", "—"))}
      {patient_panel}

      <table>
        <thead>
          <tr>
            <th style="width:28%">Test</th><th style="width:18%">Result</th>
            <th style="width:10%">Unit</th>
            <th style="width:20%">Reference Range</th><th>Remarks</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {interpretation_block}

      <div class="signature">
        <div class="line">Authorised Signatory</div>
        <div style="font-size:9pt;color:#57534e;">Laboratory Department</div>
      </div>

      <div class="footer">
        Results relate only to the sample tested. Values marked ⚠ fall outside the
        reference range and should be read alongside the clinical picture.
      </div>
    </body></html>
    """
