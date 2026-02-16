// base64url <-> ArrayBuffer helpers
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function normalizePublicKeyCreateOptions(options: any) {
  const o = options.publicKey;
  return {
    publicKey: {
      ...o,
      challenge: base64urlToBuffer(o.challenge),
      user: {
        ...o.user,
        id: base64urlToBuffer(o.user.id),
      },
    },
  };
}

export function normalizePublicKeyGetOptions(options: any) {
  const o = options.publicKey;
  return {
    publicKey: {
      ...o,
      challenge: base64urlToBuffer(o.challenge),
      allowCredentials: (o.allowCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      })),
    },
  };
}

export function credentialToJSON(cred: any) {
  if (cred instanceof ArrayBuffer) return bufferToBase64url(cred);
  if (Array.isArray(cred)) return cred.map(credentialToJSON);
  if (cred && typeof cred === "object") {
    const obj: any = {};
    for (const k in cred) obj[k] = credentialToJSON(cred[k]);
    return obj;
  }
  return cred;
}
