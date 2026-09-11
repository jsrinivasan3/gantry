/** Raw row shapes from the three NYC Open Data endpoints (spec §2.1-2.3). All fields arrive as strings from Socrata. */

export interface ElevatorComplianceRow {
  device_number: string;
  device_type?: string;
  device_status?: string;
  status_date?: string;
  bin?: string;
  borough?: string;
  house_number?: string;
  street_name?: string;
  zip_code?: string;
  latitude?: string;
  longitude?: string;
  periodic_report_year?: string;
  periodic_latest_inspection?: string;
  cat1_report_year?: string;
  cat1_latest_report_filed?: string;
  cat5_latest_report_filed?: string;
}

export interface ElevatorViolationRow {
  device_number?: string;
  bin?: string;
  boro?: string;
  issue_date?: string;
  violation_type_code?: string;
  violation_type?: string;
  violation_category?: string;
  violation_number: string;
  house_number?: string;
  street?: string;
}

export interface BoilerSafetyRow {
  tracking_number: string;
  boiler_id: string;
  report_type?: string;
  boiler_make?: string;
  boiler_model?: string;
  pressure_type?: string;
  inspection_date?: string;
  defects_exist?: string;
  report_status?: string;
  filing_fee?: string;
  total_amount_paid?: string;
  bin_number?: string;
}
