import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, onAuthStateChanged } from "firebase/auth";
import GoogleLoginButton from "../components/GoogleLoginButton";
import { auth } from "../firebase";
import {
  deleteProjectHistory,
  getProjectHistory,
  ProjectHistory,
} from "../api/history";
import { createGitLabIssue, getProjectId } from "../api/gitlab";

function UserCenter() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<ProjectHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [submittingIssueKey, setSubmittingIssueKey] = useState("");
  const [submittedIssueKeys, setSubmittedIssueKeys] = useState<string[]>([]);

  const [gitlabToken, setGitlabToken] = useState(() => {
    return localStorage.getItem("gitlabToken") || "";
  });

  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem("geminiKey") || "";
  });

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");

      const data = await getProjectHistory();
      setHistory(data);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Failed to load history."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await loadHistory();
      } else {
        setHistory([]);
        setHistoryLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteHistory = async (historyId?: string) => {
    if (!historyId) return;

    const confirmed = window.confirm("Delete this history record?");
    if (!confirmed) return;

    try {
      await deleteProjectHistory(historyId);
      setHistory((prev) => prev.filter((item) => item.id !== historyId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete history.");
    }
  };

  const handleSubmitIssue = async (
    item: ProjectHistory,
    issue: { title: string; description: string },
    index: number
  ) => {
    const token = gitlabToken.trim();

    if (!token) {
      alert("Please enter your GitLab token first.");
      return;
    }

    if (!item.repoUrl) {
      alert("Repository URL is missing.");
      return;
    }

    const issueKey = `${item.id || item.repoUrl}-${index}`;

    try {
      setSubmittingIssueKey(issueKey);

      const project = await getProjectId(item.repoUrl, token);

      await createGitLabIssue(
        project.id,
        token,
        issue.title,
        issue.description
      );

      setSubmittedIssueKeys((prev) => [...prev, issueKey]);
      alert("Issue submitted to GitLab successfully!");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit issue to GitLab."
      );
    } finally {
      setSubmittingIssueKey("");
    }
  };

  const formatDate = (value: unknown) => {
    if (!value) return "Unknown date";

    const firebaseTimestamp = value as { toDate?: () => Date };

    if (firebaseTimestamp.toDate) {
      return firebaseTimestamp.toDate().toLocaleString();
    }

    if (typeof value === "string") {
      return new Date(value).toLocaleString();
    }

    return "Unknown date";
  };

  return (
    <main className="app">
      <section className="hero-section">
        <div className="hero-badge">AI GitLab Repository Assistant</div>

        <h1>
          <span>User Center</span>
        </h1>
      </section>

      <section className="page-section user-center-section">
        <div className="user-center-top">
          <div>
            <h2>Account</h2>
            <p>Login with Google to save and view your project history.</p>

            {user && (
              <p className="user-email">
                Logged in as: <strong>{user.email}</strong>
              </p>
            )}
          </div>

          <GoogleLoginButton className="google-login-button" />
        </div>

        <div className="settings-card">
          <h2>API Settings</h2>

          <p>
            Your GitLab token and Gemini API key will be stored locally in your
            browser.
          </p>

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
        </div>

        <div className="settings-card">
          <div className="history-header">
            <div>
              <h2>Project History</h2>
              <p>Your analysed GitLab projects saved in Firebase Firestore.</p>
            </div>

            {user && (
              <button className="secondary-button" onClick={loadHistory}>
                Refresh
              </button>
            )}
          </div>

          {!user && (
            <p className="empty-message">
              Please login with Google to view your history.
            </p>
          )}

          {user && historyLoading && <p>Loading history...</p>}

          {user && historyError && (
            <p className="error-message">{historyError}</p>
          )}

          {user && !historyLoading && history.length === 0 && (
            <p className="empty-message">
              No history yet. Analyse a project first.
            </p>
          )}

          {user && history.length > 0 && (
            <div className="history-list">
              {history.map((item) => (
                <article className="history-card" key={item.id}>
                  <div className="history-card-header">
                    <div>
                      <h3>{item.projectName}</h3>
                      <p>{formatDate(item.createdAt)}</p>
                    </div>

                    <span className="history-level">
                      {item.level} / 5 · {item.levelText}
                    </span>
                  </div>

                  <p>
                    <strong>Repository:</strong>{" "}
                    <a href={item.repoUrl} target="_blank" rel="noreferrer">
                      {item.repoUrl}
                    </a>
                  </p>

                  {item.keyword && (
                    <p>
                      <strong>Keyword:</strong> {item.keyword}
                    </p>
                  )}

                  {item.techStack && (
                    <p>
                      <strong>Tech Stack:</strong> {item.techStack}
                    </p>
                  )}

                  {item.explanation && (
                    <details className="history-details">
                      <summary>View AI explanation</summary>
                      <pre>{item.explanation}</pre>
                    </details>
                  )}

                  {item.issueList && item.issueList.length > 0 && (
                    <details className="history-details">
                      <summary>View suggested issues</summary>

                      <div className="history-issue-list">
                        {item.issueList.map((issue, index) => {
                          const issueKey = `${item.id || item.repoUrl}-${index}`;
                          const isSubmitting = submittingIssueKey === issueKey;
                          const isSubmitted =
                            submittedIssueKeys.includes(issueKey);

                          return (
                            <div
                              className="history-issue-item"
                              key={`${issue.title}-${index}`}
                            >
                              <div className="history-issue-top">
                                <h4>
                                  Issue {index + 1}: {issue.title}
                                </h4>

                                <button
                                  className="primary-button"
                                  disabled={isSubmitting || isSubmitted}
                                  onClick={() =>
                                    handleSubmitIssue(item, issue, index)
                                  }
                                >
                                  {isSubmitting
                                    ? "Submitting..."
                                    : isSubmitted
                                    ? "Submitted"
                                    : "Submit to GitLab"}
                                </button>
                              </div>

                              <p>{issue.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  <div className="history-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        navigate("/understand-project", {
                          state: {
                            repoUrl: item.repoUrl,
                            projectName: item.projectName,
                            autoAnalyse: false,
                          },
                        })
                      }
                    >
                      Open Again
                    </button>

                    <button
                      className="danger-button"
                      onClick={() => handleDeleteHistory(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default UserCenter;