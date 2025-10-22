export default function LandingPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Bitrix Scheduler MVP</h1>
      <p>Это лендинг. Войдите, чтобы перейти к панели.</p>
      <a className="btn" href="/login" style={{ display: "inline-block", marginTop: 12 }}>
        Перейти к входу
      </a>
    </main>
  );
}
