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

type RepositorySource = "gitlab" | "github";

type SuggestedIssue = {
  title: string;
  description: string;
};

const getRepositorySource = (repoUrl?: string): RepositorySource => {
  if (!repoUrl) return "gitlab";

  if (repoUrl.includes("github.com")) {
    return "github";
  }

  return "gitlab";
};

const parseGitHubUrl = (repoUrl: string) => {
  const cleanUrl = repoUrl.trim().replace(/\.git$/, "");
  const match = cleanUrl.match(/github\.com[/:]([^/]+)\/([^/#?]+)/);

  if (!match) {
    throw new Error("Invalid GitHub repository URL.");
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
};

const createGitHubIssue = async (
  repoUrl: string,
  token: string,
  title: string,
  description: string
) => {
  if (!token.trim()) {
    throw new Error("GitHub token is required.");
  }

  const { owner, repo } = parseGitHubUrl(repoUrl);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: description,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    if (response.status === 403) {
      throw new Error(
        "GitHub refused to create the issue. Your token needs Issues: Read and write permission, and it must include this repository."
      );
    }

    throw new Error(data?.message || "Failed to create GitHub issue.");
  }

  return response.json();
};

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

  const [githubToken, setGithubToken] = useState(() => {
    return localStorage.getItem("githubToken") || "";
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
    issue: SuggestedIssue,
    index: number
  ) => {
    if (!item.repoUrl) {
      alert("Repository URL is missing.");
      return;
    }

    const source = getRepositorySource(item.repoUrl);
    const issueKey = `${item.id || item.repoUrl}-${index}`;

    try {
      setSubmittingIssueKey(issueKey);

      if (source === "gitlab") {
        const token = gitlabToken.trim();

        if (!token) {
          alert("Please enter your GitLab token first.");
          return;
        }

        const project = await getProjectId(item.repoUrl, token);

        await createGitLabIssue(
          project.id,
          token,
          issue.title,
          issue.description
        );

        alert("Issue submitted to GitLab successfully!");
      }

      if (source === "github") {
        const token = githubToken.trim();

        if (!token) {
          alert("Please enter your GitHub token first.");
          return;
        }

        await createGitHubIssue(
          item.repoUrl,
          token,
          issue.title,
          issue.description
        );

        alert("Issue submitted to GitHub successfully!");
      }

      setSubmittedIssueKeys((prev) => [...prev, issueKey]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit issue."
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
        <div className="hero-badge">AI Repository Assistant</div>

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
            Your GitHub token, GitLab token, and Gemini API key will be stored
            locally in your browser.
          </p>

          <label className="input-group">
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub token
            </a>
            <input
              placeholder="Paste your GitHub personal access token"
              type="password"
              value={githubToken}
              onChange={(e) => {
                setGithubToken(e.target.value);
                localStorage.setItem("githubToken", e.target.value);
              }}
            />
          </label>

          <label className="input-group">
            <a
              href="https://docs.gitlab.com/user/profile/personal_access_tokens/"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitLab token
            </a>
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
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gemini API key
            </a>
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
              {history.map((item) => {
                const source = getRepositorySource(item.repoUrl);
                const platformName = source === "github" ? "GitHub" : "GitLab";

                return (
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
                      <strong>Platform:</strong> {platformName}
                    </p>

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
                            const issueKey = `${
                              item.id || item.repoUrl
                            }-${index}`;
                            const isSubmitting =
                              submittingIssueKey === issueKey;
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
                                      : `Submit to ${platformName}`}
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
                              source,
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
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default UserCenter;