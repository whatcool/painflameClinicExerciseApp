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
        Give this code to the patient. In the app they tap <strong>“Continue with Google”</strong>,
        choose their Google account, then enter their mobile number and this code. They only do
        this once; after that, choosing the same Google account logs them in.
      </p>
      <p className="muted">
        Valid until {new Date(expiresAt).toLocaleString()}. Write it down now: it is not shown again.
        You can always create a new code from the patient’s page.
      </p>
    </div>
  );
}
