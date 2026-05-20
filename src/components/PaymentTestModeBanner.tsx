const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div style={{
      width: "100%",
      background: "#fff4e5",
      borderBottom: "1px solid #ffc486",
      padding: "8px 16px",
      textAlign: "center",
      fontSize: 13,
      color: "#8a4a00",
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      All payments made in the preview are in test mode.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "underline", fontWeight: 600, color: "#8a4a00" }}
      >
        Read more
      </a>
    </div>
  );
}
