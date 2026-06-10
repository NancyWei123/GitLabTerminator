import { useEffect, useRef, useState } from "react";
function UserCenter() {
  const [gitlabToken, setGitlabToken] = useState(() => {
    return localStorage.getItem("gitlabToken") || "";
  });
  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem("geminiKey") || "";
  });
  return (
    <main className="app">
    <section className="hero-section">
        <div className="hero-badge">AI GitLab Repository Assistant</div>

        <h1>
          <span> User Center</span>
        </h1>
        
      </section>
    <section className="page-section">
      <p>Your GitLab token and Gemini API key will be stored locally in your browser.</p>
          <label className="input-group">
            <span>GitLab token</span>
            <input
              placeholder="Paste your GitLab private token"
              type="password"
              value={gitlabToken}
              onChange={(e) => {
                setGitlabToken(e.target.value);
                localStorage.setItem("gitlabToken", e.target.value);
              }}
            />
          </label>
          <label className="input-group">
            <span>Gemini API key</span>
            <input
              placeholder="Paste your Gemini API key"
              type="password"
              value={geminiKey}
              onChange={(e) => {
                setGeminiKey(e.target.value);
                localStorage.setItem("geminiKey", e.target.value);
              }}
            />
          </label>

    </section>
    </main>
  );
}

export default UserCenter;