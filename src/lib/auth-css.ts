export const authPageCss = `
.auth-page { min-height: 100vh; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; position: relative; }
.auth-home { position: absolute; top: 24px; left: 24px; color: #fff; text-decoration: none; font-size: 12px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; }
.auth-home:hover { color: #D75F68; }
.auth-card { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 12px; }
.auth-title { font-size: 20px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin: 0 0 12px; }
.auth-input { width: 100%; background: #000; color: #fff; border: 1px solid #fff; padding: 12px 14px; font-size: 14px; border-radius: 0; outline: none; font-family: inherit; }
.auth-input:focus { border-color: #D75F68; }
.auth-input::placeholder { color: #777; }
.auth-btn { background: #D75F68; color: #fff; border: 1px solid #D75F68; padding: 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; font-family: inherit; margin-top: 4px; }
.auth-btn:hover { background: #fff; color: #D75F68; }
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.auth-google { display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: #fff; color: #000; border: 1px solid #fff; padding: 12px; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; font-family: inherit; }
.auth-google:hover { background: #f1f1f1; }
.auth-or { display: flex; align-items: center; gap: 10px; color: #666; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin: 4px 0; }
.auth-or::before, .auth-or::after { content: ""; flex: 1; height: 1px; background: #333; }
.auth-error { color: #D75F68; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
.auth-foot { font-size: 12px; color: #999; margin-top: 12px; text-align: center; letter-spacing: 0.02em; }
.auth-foot a { color: #fff; text-decoration: underline; }
.auth-foot a:hover { color: #D75F68; }
`;
