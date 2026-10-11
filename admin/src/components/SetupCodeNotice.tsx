/** Shows a one-time setup code to hand to the patient. It is never shown again. */
export function SetupCodeNotice({
  code,
  expiresAt,
  mobile,
}: {
  code: string;
  expiresAt: string;
  mobile: string;
}) {
  return (
    <div className="notice">
      <div className="muted">One-time code for {mobile}</div>
      <div className="code">{code}</div>
      <p>
        Give this code to the patient. In the app they tap <strong>“Activate with clinic code”</strong>,
        enter their mobile number, this code and a new 6-digit PIN.
      </p>
      <p className="muted">
        Valid until {new Date(expiresAt).toLocaleString()}. Write it down now: it is not shown again.
        You can always create a new code from the patient’s page.
      </p>
    </div>
  );
}
