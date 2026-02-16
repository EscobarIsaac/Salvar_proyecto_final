const API = "http://localhost:8000";

export async function webauthnRegisterOptions(user_id: string) {
  const res = await fetch(`${API}/api/webauthn/register/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function webauthnRegisterVerify(user_id: string, credential: any) {
  const res = await fetch(`${API}/api/webauthn/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, credential }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function webauthnLoginOptions(user_id: string) {
  const res = await fetch(`${API}/api/webauthn/login/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function webauthnLoginVerify(user_id: string, credential: any) {
  const res = await fetch(`${API}/api/webauthn/login/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, credential }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
