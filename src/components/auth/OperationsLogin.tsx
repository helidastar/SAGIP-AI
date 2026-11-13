
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { StaffUser } from "@/components/dashboard/StaffProvider";
import styles from "@/components/auth/operations-login.module.css";

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "invalid" }
  | { kind: "empty"; email: string | null; password: string | null }
  | { kind: "locked" }
  | { kind: "failure"; message: string };

type PreviewState = "idle" | "submitting" | "invalid" | "empty" | "locked";
type LoginMode = "login" | "signup";

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
        <span>Demo data environment</span>
        <span>© 2025 SAGIP-AI Operations Command Center. Restricted Access.</span>
      </div>
    </footer>
  );
}

export function FormError({
  children,
  locked = false,
  id = "form-error",
}: {
  children: ReactNode;
  locked?: boolean;
  id?: string;
}) {
  if (!children) return null;
  return (
    <div className={`${styles.formError} ${locked ? styles.lockedError : ""}`} id={id} role="alert">
      {locked ? (
        <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" />
        </svg>
      ) : (
        <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3 22 21H2L12 3Z" />
          <path d="M12 9v5m0 3h.01" />
        </svg>
      )}
      <p>{children}</p>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  error,
  invalid = false,
  disabled = false,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`${styles.inputWrap} ${error || invalid ? styles.inputInvalid : ""}`}>
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
        disabled={disabled}
        required
        aria-invalid={Boolean(error) || invalid}
        aria-describedby={error && !invalid ? "password-error" : describedBy}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
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

export function SubmitButton({
  loading,
  locked,
  disabled,
  label,
}: {
  loading: boolean;
  locked?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button className={styles.submitButton} type="submit" disabled={loading || locked || disabled} aria-busy={loading}>
      <span>{loading ? "Verifying EOC credentials..." : locked ? "Terminal Locked" : label ?? "Log In to Operations Portal"}</span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {locked && <span className={styles.lockedMark} aria-hidden="true">⊘</span>}
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

export function OperationsLogin({
  redirectTo = "/admin/dashboard",
  previewState,
  previewMode = "login",
}: {
  redirectTo?: string;
  previewState?: PreviewState;
  previewMode?: LoginMode;
} = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>(previewMode);
  const [formState, setFormState] = useState<FormState>(() => {
    if (previewState === "submitting") return { kind: "submitting" };
    if (previewState === "invalid") return { kind: "invalid" };
    if (previewState === "empty") return { kind: "empty", email: "Email is required", password: "Password is required" };
    if (previewState === "locked") return { kind: "locked" };
    return { kind: "idle" };
  });

  const submitting = formState.kind === "submitting";
  const locked = formState.kind === "locked";
  const emailError = formState.kind === "empty" ? formState.email : null;
  const passwordError = formState.kind === "empty" ? formState.password : null;
  const formError = formState.kind === "invalid"
    ? "Incorrect username or password"
    : formState.kind === "locked"
      ? "Access Denied: Terminal Lockout. Your account is temporarily locked. Contact the EOC Duty Desk."
      : formState.kind === "failure"
        ? formState.message
        : "";

  function clearRecoverableError(field: "email" | "password", hasValue: boolean) {
    setFormState((current) => {
      if (current.kind === "empty") {
        const nextEmail = field === "email" && hasValue ? null : current.email;
        const nextPassword = field === "password" && hasValue ? null : current.password;
        return nextEmail || nextPassword
          ? { kind: "empty", email: nextEmail, password: nextPassword }
          : { kind: "idle" };
      }
      if (current.kind === "invalid" || current.kind === "failure") return { kind: "idle" };
      return current;
    });
  }

  function switchMode(nextMode: LoginMode) {
    if (submitting) return;
    setMode(nextMode);
    setFormState({ kind: "idle" });
    setPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" || locked || submitting) return;

    const nextEmailError = email.trim() ? null : "Email is required";
    const nextPasswordError = password ? null : "Password is required";
    if (nextEmailError || nextPasswordError) {
      setFormState({ kind: "empty", email: nextEmailError, password: nextPasswordError });
      return;
    }

    setFormState({ kind: "submitting" });
    const result = await api<StaffUser>("/api/auth/login", {
      method: "POST",
      json: { email: email.trim(), password },
    });

    if (!result.ok) {
      setPassword("");
      const errorCode = result.error?.toLowerCase() ?? "";
      if (
        result.status === 423
        || result.status === 429
        || errorCode === "account_locked"
        || errorCode === "too_many_attempts"
        || errorCode === "over_request_rate_limit"
      ) {
        setFormState({ kind: "locked" });
      } else if (result.status === 401) {
        setFormState({ kind: "invalid" });
      } else if (result.status === 403) {
        setFormState({ kind: "failure", message: "Access denied. This account does not have permission to enter the Operations Portal." });
      } else if (result.status === 0 || result.status === 503 || errorCode === "network_error") {
        setFormState({ kind: "failure", message: "Unable to connect to the authentication service. Check your connection and try again." });
      } else if (errorCode === "verification_failed") {
        setFormState({ kind: "failure", message: "Unable to verify your access permissions. Please try again." });
      } else {
        setFormState({ kind: "failure", message: "Unable to sign in right now. Please try again." });
      }
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  const alertDescription = formError ? "form-error" : undefined;

  return (
    <div className={styles.page}>
      <BackgroundPattern />
      <PortalHeader />
      <main className={styles.main}>
        <LoginCard>
          <div className={styles.modeSwitch} role="group" aria-label="Account access">
            <button
              type="button"
              className={mode === "login" ? styles.modeActive : styles.modeButton}
              onClick={() => switchMode("login")}
              disabled={submitting || locked}
              aria-pressed={mode === "login"}
            >
              Log In
            </button>
            <button
              type="button"
              className={mode === "signup" ? styles.modeActive : styles.modeButton}
              onClick={() => switchMode("signup")}
              disabled={submitting || locked}
              aria-pressed={mode === "signup"}
            >
              Sign Up
            </button>
          </div>
          <form className={styles.form} onSubmit={submit} noValidate aria-busy={submitting}>
            {formState.kind === "invalid" && <FormError>{formError}</FormError>}
            {formState.kind === "locked" && <FormError locked>{formError}</FormError>}
            {formState.kind === "failure" && <FormError>{formError}</FormError>}
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="personnel-email">Email</label>
                {mode === "login" && <span className={styles.terminal}>Terminal DRRM-04</span>}
              </div>
              <div className={`${styles.inputWrap} ${emailError || formState.kind === "invalid" ? styles.inputInvalid : ""}`}>
                <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="personnel-email"
                  className={styles.input}
                  type="email"
                  autoComplete={mode === "login" ? "username" : "email"}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearRecoverableError("email", Boolean(event.target.value.trim()));
                  }}
                  disabled={submitting}
                  required
                  aria-invalid={Boolean(emailError) || formState.kind === "invalid"}
                  aria-describedby={emailError ? "email-error" : alertDescription}
                />
              </div>
              {emailError && <p className={styles.fieldError} id="email-error" role="alert">{emailError}</p>}
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="personnel-password">Password</label>
                {mode === "login" && <span className={styles.recoveryText}>Token recovery?</span>}
              </div>
              <PasswordInput
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  clearRecoverableError("password", Boolean(value));
                }}
                error={passwordError ?? (formState.kind === "invalid" ? "Incorrect username or password" : undefined)}
                invalid={formState.kind === "invalid"}
                disabled={submitting}
                describedBy={alertDescription}
              />
              {passwordError && <p className={styles.fieldError} id="password-error" role="alert">{passwordError}</p>}
            </div>

            <SubmitButton
              loading={submitting}
              locked={locked}
              disabled={mode === "signup"}
              label={mode === "signup" ? "Sign Up" : undefined}
            />
            {mode === "signup" && (
              <p className={styles.signupNotice} role="status">
                Staff accounts are created by an administrator. Sign-up is not available here.
              </p>
            )}
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