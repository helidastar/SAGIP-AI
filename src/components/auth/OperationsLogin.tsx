
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { StaffUser } from "@/components/dashboard/StaffProvider";
import styles from "@/components/auth/operations-login.module.css";

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`${styles.brandMark} ${className}`}>
      <ShieldIcon />
    </span>
  );
}

function BackgroundPattern() {
  return (
    <svg className={styles.backgroundGraphic} viewBox="0 0 800 600" fill="none" aria-hidden="true">
      <circle cx="400" cy="300" r="278" stroke="currentColor" strokeDasharray="1 7" />
      <path d="M65 300 400 55l335 245-335 245L65 300Z" stroke="currentColor" />
      <path d="m117 300 283-207 283 207-283 207-283-207Z" stroke="currentColor" />
      <path d="m172 300 228-167 228 167-228 167-228-167Z" stroke="currentColor" />
      <path d="M65 300h670M400 22v556" stroke="currentColor" strokeDasharray="4 7" />
    </svg>
  );
}

function PortalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerBrand}>
        <BrandMark />
        <span className={styles.headerName}>SAGIP-AI</span>
        <span className={styles.headerPortal}>Operations Portal</span>
      </div>
      <a className={styles.hotline} href="tel:911">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1.1-.9 2-2 2C10 21 3 14 3 5c0-1.1.9-2 2-2Z" />
        </svg>
        <span>Hotline: 911 / (02) 8988-1000</span>
      </a>
    </header>
  );
}

function PortalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.certification}>
        <ShieldIcon />
        <span>ISO 22301 / DRRM Compliance Protocol V4.2 Certified</span>
      </div>
      <div className={styles.footerMeta}>
        <span>© 2025 SAGIP-AI Operations Command Center. Restricted Access.</span>
      </div>
    </footer>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={styles.formError} role="alert">
      <span className={styles.errorMark} aria-hidden="true">!</span>
      <p>{children}</p>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`${styles.inputWrap} ${error ? styles.inputInvalid : ""}`}>
      <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2" />
      </svg>
      <input
        id="personnel-password"
        className={styles.input}
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "password-error" : undefined}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M3 3 21 21M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.5 4.8 9.5 7-.4.8-1.2 2.1-2.5 3.3M6.2 6.2C3.9 7.7 2.8 9.7 2.5 12c.5 1.1 3.8 7 9.5 7 1.1 0 2.1-.2 3-.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button className={styles.submitButton} type="submit" disabled={loading} aria-busy={loading}>
      <span>{loading ? "Verifying EOC credentials..." : "Log In to Operations Portal"}</span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}

export function LoginCard({ children }: { children: ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby="personnel-heading">
      <div className={styles.cardBrand}>
        <div className={styles.cardBrandMain}>
          <BrandMark />
          <div className={styles.brandCopy}>
            <span className={styles.brandName}>SAGIP-AI</span>
            <span className={styles.brandSubtitle}>Gov Command Mesh</span>
          </div>
        </div>
        <span className={styles.cardPortal}>Operations Portal</span>
      </div>
      <h1 className={styles.title} id="personnel-heading">Personnel Authentication</h1>
      <p className={styles.description}>
        Enter your duty credentials to access disaster triage, incident dispatch, and predictive geospatial telemetries.
      </p>
      {children}
    </section>
  );
}

export function OperationsLogin({ redirectTo = "/admin/dashboard" }: { redirectTo?: string } = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const nextEmailError = email.trim() ? "" : "Email is required";
    const nextPasswordError = password ? "" : "Password is required";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    setLoading(true);
    const result = await api<StaffUser>("/api/auth/login", {
      method: "POST",
      json: { email: email.trim(), password },
    });
    setLoading(false);

    if (!result.ok) {
      const message = result.status === 401
        ? "Incorrect username or password"
        : result.status === 403
          ? "Access denied. This account does not have permission to enter the Operations Portal."
          : result.status === 423
            ? "This account is locked. Contact your administrator."
            : result.status === 0 || result.error === "network_error"
              ? "Unable to connect to the authentication service. Check your connection and try again."
              : result.error === "verification_failed"
                ? "Unable to verify your access permissions. Please try again."
              : "Unable to sign in right now. Please try again.";
      setFormError(message);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <BackgroundPattern />
      <PortalHeader />
      <main className={styles.main}>
        <LoginCard>
          <form className={styles.form} onSubmit={submit} noValidate>
            <FormError>{formError}</FormError>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="personnel-email">Email</label>
                <span className={styles.terminal}>Terminal DRRM-04</span>
              </div>
              <div className={`${styles.inputWrap} ${emailError ? styles.inputInvalid : ""}`}>
                <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="personnel-email"
                  className={styles.input}
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (event.target.value.trim()) setEmailError("");
                  }}
                  required
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
              </div>
              {emailError && <p className={styles.fieldError} id="email-error" role="alert">{emailError}</p>}
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="personnel-password">Password</label>
                <span className={styles.recoveryText}>Token recovery?</span>
              </div>
              <PasswordInput
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  if (value) setPasswordError("");
                }}
                error={passwordError}
              />
              {passwordError && <p className={styles.fieldError} id="password-error" role="alert">{passwordError}</p>}
            </div>

            <SubmitButton loading={loading} />
          </form>

          <div className={styles.clearance}>
            <div className={styles.clearanceHeading}>
              <span className={styles.clearanceTitle}><ShieldIcon /> Access Clearance</span>
              <span className={styles.clearanceTag}>SEC-LEVEL-3 RESTRICTED</span>
            </div>
            <p className={styles.clearanceText}>
              Authorized personnel only. All access attempts are cryptographically signed, timestamped, and audited under RA 10121 (DRRM Act) and RA 10173 (Data Privacy Act).
            </p>
          </div>
          <span className={styles.contact}>Contact EOC Duty Desk</span>
        </LoginCard>
      </main>
      <PortalFooter />
    </div>
  );
}