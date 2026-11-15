"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import styles from "@/components/auth/staff-auth.module.css";

type LoginMode = "login" | "signup";
type PreviewState = "idle" | "focused" | "submitting" | "invalid" | "empty" | "locked";
type SignUpField = "name" | "lastName" | "email" | "password" | "contact" | "address";
type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "invalid" }
  | { kind: "empty"; errors: Partial<Record<SignUpField, string>> }
  | { kind: "locked" }
  | { kind: "failure"; message: string };

const EMPTY_FIELDS: SignUpField[] = ["name", "lastName", "email", "password", "contact", "address"];
const FIELD_LABELS: Record<SignUpField, string> = {
  name: "Name",
  lastName: "Last name",
  email: "Email",
  password: "Password",
  contact: "Contact number",
  address: "Address",
};

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BrandMark() {
  return (
    <span className={styles.brandMark}>
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

function FormError({ children, locked = false }: { children: ReactNode; locked?: boolean }) {
  if (!children) return null;
  return (
    <div
      className={`${styles.formError} ${locked ? styles.lockedError : ""}`}
      id="form-error"
      role="alert"
      aria-live="assertive"
    >
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

function PasswordInput({
  id,
  value,
  error,
  invalid = false,
  disabled = false,
  autoComplete,
  onChange,
}: {
  id: string;
  value: string;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`${styles.inputWrap} ${error || invalid ? styles.inputInvalid : ""}`}>
      <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2" />
      </svg>
      <input
        id={id}
        className={styles.input}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        aria-invalid={Boolean(error) || invalid}
        aria-describedby={error ? `${id}-error` : invalid ? "form-error" : undefined}
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

function SubmitButton({
  mode,
  submitting,
  locked,
  disabled = false,
}: {
  mode: LoginMode;
  submitting: boolean;
  locked: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={styles.submitButton}
      type="submit"
      disabled={submitting || locked || disabled}
      aria-busy={submitting}
    >
      <span>
        {submitting
          ? "Verifying EOC credentials..."
          : locked
            ? "Terminal Locked"
            : mode === "login"
              ? "Log In to Operations Portal"
              : "Sign Up"}
      </span>
      {submitting && <span className={styles.spinner} aria-hidden="true" />}
      {locked && <span className={styles.lockedMark} aria-hidden="true">⊘</span>}
    </button>
  );
}

function LoginCard({ mode, children }: { mode: LoginMode; children: ReactNode }) {
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
      <h1 className={styles.title} id="personnel-heading">
        {mode === "login" ? "Personnel Authentication" : "Personnel Registration"}
      </h1>
      <p className={styles.description}>
        {mode === "login"
          ? "Enter your duty credentials to access disaster triage, incident dispatch, and predictive geospatial telemetries."
          : "Create your SAGIP-AI account to access disaster response services."}
      </p>
      {children}
    </section>
  );
}

function TextField({
  id,
  label,
  type = "text",
  value,
  error,
  disabled,
  autoComplete,
  autoFocus = false,
  onChange,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "tel";
  value: string;
  error?: string;
  disabled: boolean;
  autoComplete: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={`${styles.inputWrap} ${error ? styles.inputInvalid : ""}`}>
        {type === "email" ? (
          <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        ) : type === "tel" ? (
          <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1.1-.9 2-2 2C10 21 3 14 3 5c0-1.1.9-2 2-2Z" />
          </svg>
        ) : (
          <svg className={styles.leadingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        )}
        <input
          id={id}
          className={styles.input}
          type={type}
          autoComplete={autoComplete}
          autoCapitalize={type === "email" ? "none" : undefined}
          spellCheck={type === "email" ? false : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && <p className={styles.fieldError} id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

export function StaffAuthPage({
  redirectTo,
  previewState,
  previewMode = "login",
  fontClassName,
}: {
  redirectTo: string;
  previewState?: PreviewState;
  previewMode?: LoginMode;
  fontClassName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(previewMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [formState, setFormState] = useState<FormState>(() => {
    if (previewState === "submitting") return { kind: "submitting" };
    if (previewState === "invalid") return { kind: "invalid" };
    if (previewState === "empty") {
      return {
        kind: "empty",
        errors: Object.fromEntries(
          (previewMode === "signup" ? EMPTY_FIELDS : ["email", "password"]).map((field) => [
            field,
            `${FIELD_LABELS[field as SignUpField]} is required`,
          ]),
        ),
      };
    }
    if (previewState === "locked") return { kind: "locked" };
    return { kind: "idle" };
  });

  const submitting = formState.kind === "submitting";
  const locked = formState.kind === "locked";
  const fieldErrors = formState.kind === "empty" ? formState.errors : {};
  const formError = formState.kind === "invalid"
    ? "Incorrect username or password"
    : formState.kind === "locked"
      ? "Access Denied: Terminal Lockout. Your account is temporarily locked. Contact the EOC Duty Desk."
      : formState.kind === "failure"
        ? formState.message
        : "";

  function updateField(field: SignUpField, value: string, setValue: (next: string) => void) {
    setValue(value);
    setFormState((current) => {
      if (current.kind === "empty") {
        const errors = { ...current.errors };
        if (value.trim()) delete errors[field];
        else errors[field] = `${FIELD_LABELS[field]} is required`;
        return Object.keys(errors).length ? { kind: "empty", errors } : { kind: "idle" };
      }
      if (current.kind === "invalid" || current.kind === "failure") return { kind: "idle" };
      return current;
    });
  }

  function switchMode(nextMode: LoginMode) {
    if (submitting || locked) return;
    setMode(nextMode);
    setFormState({ kind: "idle" });
    setPassword("");
  }

  function validateRequiredFields(): Partial<Record<SignUpField, string>> {
    const values: Record<SignUpField, string> = {
      name,
      lastName,
      email,
      password,
      contact,
      address,
    };
    const fields = mode === "login" ? ["email", "password"] as const : EMPTY_FIELDS;
    return Object.fromEntries(
      fields.filter((field) => !values[field].trim())
        .map((field) => [field, `${FIELD_LABELS[field]} is required`]),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || locked) return;

    const errors = validateRequiredFields();
    if (Object.keys(errors).length) {
      setFormState({ kind: "empty", errors });
      return;
    }

    if (mode === "signup") {
      setFormState({ kind: "failure", message: "Account creation is not connected yet. Please use Log In or contact the EOC Duty Desk." });
      return;
    }

    setFormState({ kind: "submitting" });
    const result = await api("/api/auth/login", {
      method: "POST",
      json: { email: email.trim(), password },
    });

    if (!result.ok) {
      setPassword("");
      if (result.status === 401) {
        setFormState({ kind: "invalid" });
      } else if (result.status === 0) {
        setFormState({ kind: "failure", message: "Unable to connect. Check your network connection and retry." });
      } else if (result.status === 403) {
        setFormState({ kind: "failure", message: "Access denied. This account does not have permission to enter the Operations Portal." });
      } else {
        setFormState({ kind: "failure", message: "Unable to sign in right now. Please try again." });
      }
      return;
    }

    const safeRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/dashboard";
    router.push(safeRedirect);
    router.refresh();
  }

  return (
    <div className={`${styles.page} ${fontClassName}`}>
      <BackgroundPattern />
      <PortalHeader />
      <main className={styles.main}>
        <LoginCard mode={mode}>
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
            {(formState.kind === "invalid" || formState.kind === "failure") && <FormError>{formError}</FormError>}
            {formState.kind === "locked" && <FormError locked>{formError}</FormError>}

            {mode === "login" ? (
              <>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="personnel-email">Email</label>
                    <span className={styles.terminal}>Terminal DRRM-04</span>
                  </div>
                  <div className={`${styles.inputWrap} ${fieldErrors.email || formState.kind === "invalid" ? styles.inputInvalid : ""}`}>
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
                      onChange={(event) => updateField("email", event.target.value, setEmail)}
                      disabled={submitting}
                      autoFocus={previewState === "focused"}
                      required
                      aria-invalid={Boolean(fieldErrors.email) || formState.kind === "invalid"}
                      aria-describedby={fieldErrors.email ? "personnel-email-error" : formError ? "form-error" : undefined}
                    />
                  </div>
                  {fieldErrors.email && <p className={styles.fieldError} id="personnel-email-error" role="alert">{fieldErrors.email}</p>}
                </div>

                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="personnel-password">Password</label>
                    <span className={styles.recoveryText}>Token recovery?</span>
                  </div>
                  <PasswordInput
                    id="personnel-password"
                    value={password}
                    error={fieldErrors.password}
                    invalid={formState.kind === "invalid"}
                    disabled={submitting}
                    autoComplete="current-password"
                    onChange={(value) => updateField("password", value, setPassword)}
                  />
                  {fieldErrors.password && <p className={styles.fieldError} id="personnel-password-error" role="alert">{fieldErrors.password}</p>}
                </div>
              </>
            ) : (
              <div className={styles.signupFields}>
                <TextField
                  id="signup-name"
                  label="Name"
                  value={name}
                  error={fieldErrors.name}
                  disabled={submitting}
                  autoComplete="given-name"
                  onChange={(value) => updateField("name", value, setName)}
                />
                <TextField
                  id="signup-last-name"
                  label="Last name"
                  value={lastName}
                  error={fieldErrors.lastName}
                  disabled={submitting}
                  autoComplete="family-name"
                  onChange={(value) => updateField("lastName", value, setLastName)}
                />
                <TextField
                  id="signup-email"
                  label="Email"
                  type="email"
                  value={email}
                  error={fieldErrors.email}
                  disabled={submitting}
                  autoComplete="email"
                  autoFocus={previewState === "focused"}
                  onChange={(value) => updateField("email", value, setEmail)}
                />
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="signup-password">Password</label>
                  <PasswordInput
                    id="signup-password"
                    value={password}
                    error={fieldErrors.password}
                    disabled={submitting}
                    autoComplete="new-password"
                    onChange={(value) => updateField("password", value, setPassword)}
                  />
                  {fieldErrors.password && <p className={styles.fieldError} id="signup-password-error" role="alert">{fieldErrors.password}</p>}
                </div>
                <TextField
                  id="signup-contact"
                  label="Contact number"
                  type="tel"
                  value={contact}
                  error={fieldErrors.contact}
                  disabled={submitting}
                  autoComplete="tel"
                  onChange={(value) => updateField("contact", value, setContact)}
                />
                <TextField
                  id="signup-address"
                  label="Address"
                  value={address}
                  error={fieldErrors.address}
                  disabled={submitting}
                  autoComplete="street-address"
                  onChange={(value) => updateField("address", value, setAddress)}
                />
              </div>
            )}

            <SubmitButton
              mode={mode}
              submitting={submitting}
              locked={locked}
            />
            <p className={styles.modePrompt}>
              {mode === "login" ? (
                <>No account yet? <button type="button" onClick={() => switchMode("signup")} disabled={submitting || locked}>Sign up</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => switchMode("login")} disabled={submitting || locked}>Log in</button></>
              )}
            </p>
          </form>

          {mode === "login" && (
            <div className={styles.clearance}>
              <div className={styles.clearanceHeading}>
                <span className={styles.clearanceTitle}><ShieldIcon /> Authorized personnel only</span>
                <span className={styles.clearanceTag}>SEC-LEVEL-3 RESTRICTED</span>
              </div>
              <p className={styles.clearanceText}>
                All access attempts are cryptographically signed, timestamped, and audited under RA 10121 (DRRM Act) and RA 10173 (Data Privacy Act).
              </p>
            </div>
          )}
          {mode === "login" && <span className={styles.contact}>Contact EOC Duty Desk</span>}
        </LoginCard>
      </main>
      <PortalFooter />
    </div>
  );
}
