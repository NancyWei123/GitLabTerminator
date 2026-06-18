import { useState } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import {
  getProjectId,
  getRepositoryTree,
  getRawFile,
  createGitLabIssue,
} from "../api/gitlab";
import { askGemini } from "../api/gemini";
import { saveProjectHistory } from "../api/history";

type RepositorySource = "gitlab" | "github";

type AnalysePageState = {
  repoUrl?: string;
  projectName?: string;
  autoAnalyse?: boolean;
  source?: RepositorySource;
  level?: string;
};

type SuggestedIssue = {
  title: string;
  description: string;
};

type AnalysedFile = {
  path: string;
  content: string;
};

type LanguageOption = {
  label: string;
  value: string;
  instruction: string;
};

type GitHubRepoInfo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch?: string;
  owner: string;
  repo: string;
};

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
};

const languageOptions: LanguageOption[] = [
  {
    label: "English",
    value: "English",
    instruction: "Write the whole answer in clear beginner-friendly English.",
  },
  {
    label: "中文",
    value: "Chinese",
    instruction: "请用清楚、适合初学者理解的中文回答。",
  },
];

const levelDescriptions: Record<number, string> = {
  1: "Very beginner. Explain like the user is new to programming.",
  2: "Beginner. Explain basic concepts and avoid advanced jargon.",
  3: "Intermediate. Use normal developer terms, but still explain clearly.",
  4: "Advanced. Include architecture, trade-offs, and implementation details.",
  5: "Expert. Use deep technical explanation, architecture reasoning, and improvement strategy.",
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

const githubHeaders = (
  token: string,
  accept = "application/vnd.github+json"
) => {
  return {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token.trim() ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const throwGitHubError = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  throw new Error(data?.message || fallback);
};

const getGitHubRepo = async (
  repoUrl: string,
  token: string
): Promise<GitHubRepoInfo> => {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: githubHeaders(token),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, "Failed to fetch GitHub repository.");
  }

  const data = await response.json();

  return {
    id: data.id,
    name: data.name,
    full_name: data.full_name,
    description: data.description,
    html_url: data.html_url,
    default_branch: data.default_branch,
    owner,
    repo,
  };
};

const getGitHubRepositoryTree = async (
  owner: string,
  repo: string,
  token: string,
  branch: string
): Promise<GitHubTreeItem[]> => {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      branch
    )}?recursive=1`,
    {
      headers: githubHeaders(token),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, "Failed to fetch GitHub repository tree.");
  }

  const data = await response.json();

  return data.tree || [];
};

const getGitHubRawFile = async (
  owner: string,
  repo: string,
  token: string,
  filePath: string,
  branch: string
): Promise<string> => {
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(
      branch
    )}`,
    {
      headers: githubHeaders(token, "application/vnd.github.raw"),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, `Failed to fetch file: ${filePath}`);
  }

  return response.text();
};

const createGitHubIssue = async (
  owner: string,
  repo: string,
  token: string,
  title: string,
  description: string
) => {
  if (!token.trim()) {
    throw new Error("GitHub token is required to create an issue.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: description,
      }),
    }
  );

  if (!response.ok) {
    await throwGitHubError(response, "Failed to create GitHub issue.");
  }

  return response.json();
};

const isImportantFile = (filePath: string) => {
  const path = filePath.toLowerCase();

  return (
    path === "readme.md" ||
    path === "package.json" ||
    path === "requirements.txt" ||
    path === "pom.xml" ||
    path === "build.gradle" ||
    path === "build.gradle.kts" ||
    path === "vite.config.ts" ||
    path === "vite.config.js" ||
    path === "tsconfig.json" ||
    path === "dockerfile" ||
    path === "docker-compose.yml" ||
    path.startsWith("src/") ||
    path.startsWith("app/") ||
    path.startsWith("pages/") ||
    path.startsWith("components/")
  );
};

function App() {
  const location = useLocation();
  const routeState = location.state as AnalysePageState | null;

  const [repoUrl, setRepoUrl] = useState(() => {
    return routeState?.repoUrl || "";
  });

  const [source, setSource] = useState<RepositorySource>(() => {
    if (routeState?.source) return routeState.source;
    if (routeState?.repoUrl?.includes("github.com")) return "github";
    return "gitlab";
  });

  const [gitlabToken, setGitlabToken] = useState(() => {
    return localStorage.getItem("gitlabToken") || "";
  });

  const [githubToken, setGithubToken] = useState(() => {
    return localStorage.getItem("githubToken") || "";
  });

  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem("geminiKey") || "";
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("explanationLanguage") || "English";
  });

  const [techLevel, setTechLevel] = useState(() => {
    const routeLevel = Number(routeState?.level);
    if (routeLevel >= 1 && routeLevel <= 5) return routeLevel;

    return Number(localStorage.getItem("technologyLevel")) || 2;
  });

  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [issues, setIssues] = useState<SuggestedIssue[]>([]);

  const [repositoryRef, setRepositoryRef] = useState<{
    source: RepositorySource;
    gitlabProjectId?: number;
    githubOwner?: string;
    githubRepo?: string;
  } | null>(null);

  const selectedLanguage =
    languageOptions.find((option) => option.value === language) ||
    languageOptions[0];

  const platformName = source === "github" ? "GitHub" : "GitLab";

  const parseIssues = (text: string): SuggestedIssue[] => {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  };

  const analyseRepo = async () => {
    if (!repoUrl.trim() || !geminiKey.trim()) {
      alert("Please enter the repository URL and Gemini API key.");
      return;
    }

    if (source === "gitlab" && !gitlabToken.trim()) {
      alert("Please enter your GitLab token.");
      return;
    }

    try {
      setLoading(true);
      setExplanation("");
      setIssues([]);
      setProjectId(null);
      setRepositoryRef(null);

      let repositoryName = "";
      let repositoryDescription = "";
      let repositoryWebUrl = "";
      const files: AnalysedFile[] = [];

      if (source === "gitlab") {
        const project = await getProjectId(repoUrl, gitlabToken);

        setProjectId(project.id);
        setRepositoryRef({
          source: "gitlab",
          gitlabProjectId: project.id,
        });

        repositoryName = project.name;
        repositoryDescription = project.description || "No description";
        repositoryWebUrl = project.web_url;

        const tree = await getRepositoryTree(project.id, gitlabToken);

        const importantFiles = tree
          .filter((item) => item.type === "blob")
          .filter((item) => isImportantFile(item.path))
          .slice(0, 14);

        for (const file of importantFiles) {
          const content = await getRawFile(
            project.id,
            file.path,
            gitlabToken,
            project.default_branch || "main"
          );

          if (content.trim()) {
            files.push({
              path: file.path,
              content: content.slice(0, 5000),
            });
          }
        }
      }

      if (source === "github") {
        const repo = await getGitHubRepo(repoUrl, githubToken);

        setProjectId(repo.id);
        setRepositoryRef({
          source: "github",
          githubOwner: repo.owner,
          githubRepo: repo.repo,
        });

        repositoryName = repo.name;
        repositoryDescription = repo.description || "No description";
        repositoryWebUrl = repo.html_url;

        const branch = repo.default_branch || "main";

        const tree = await getGitHubRepositoryTree(
          repo.owner,
          repo.repo,
          githubToken,
          branch
        );

        const importantFiles = tree
          .filter((item) => item.type === "blob")
          .filter((item) => isImportantFile(item.path))
          .slice(0, 14);

        for (const file of importantFiles) {
          const content = await getGitHubRawFile(
            repo.owner,
            repo.repo,
            githubToken,
            file.path,
            branch
          );

          if (content.trim()) {
            files.push({
              path: file.path,
              content: content.slice(0, 5000),
            });
          }
        }
      }

      const prompt = `
You are an AI ${platformName} repository teacher.

The user selected this output language:
${selectedLanguage.value}

Language instruction:
${selectedLanguage.instruction}

The user selected this technology explanation level:
${"⭐".repeat(techLevel)} (${techLevel}/5)

Technology level instruction:
${levelDescriptions[techLevel]}

Analyse this repository and return the answer in the selected language.

Please include:

1. Project summary
   - Explain what this project does.
   - Explain who may use it.

2. Technology level rating
   - Give a rating from 1 to 5 stars.
   - Format: Technology Level: ${"⭐".repeat(techLevel)} (${techLevel}/5)
   - Explain why this project matches this level.

3. Tech stack
   - List the main technologies.
   - Explain the role of each technology.

4. Main folder/file structure
   - Explain the important files and folders.

5. Beginner learning path
   - Tell the user what to learn first.
   - Give a simple order to read the project.

6. How to run this project
   - Give clear setup steps.
   - Mention possible commands if they can be inferred.

7. 5 suggested ${platformName} issues
   - Each issue must include:
     - title
     - why it matters
     - how to fix it
     - difficulty: easy / medium / hard

Repository platform:
${platformName}

Repository name:
${repositoryName}

Repository description:
${repositoryDescription}

Files:
${files
  .map(
    (file) => `
--- FILE: ${file.path} ---
${file.content}
`
  )
  .join("\n")}
`;

      const result = await askGemini(geminiKey, prompt);
      setExplanation(result);

      const issuePrompt = `
Based on this repository analysis, create exactly 5 ${platformName} issues.

Return ONLY valid JSON.
No markdown.
Use this language for the issue title and description:
${selectedLanguage.value}

Language instruction:
${selectedLanguage.instruction}

Technology explanation level:
${techLevel}/5 - ${levelDescriptions[techLevel]}

Format:
[
  {
    "title": "Issue title",
    "description": "Detailed issue description with why it matters, fix steps, and difficulty"
  }
]

Repository analysis:
${result}
`;

      const issueJson = await askGemini(geminiKey, issuePrompt);
      const parsedIssues = parseIssues(issueJson);

      setIssues(parsedIssues);

      try {
        await saveProjectHistory({
          projectName: repositoryName,
          repoUrl: repositoryWebUrl,
          keyword: "",
          techStack: "",
          level: String(techLevel),
          levelText: `${techLevel}/5`,
          explanation: result,
          issueList: parsedIssues,
        });

        alert("Analysis saved to your history!");
      } catch (saveError) {
        console.error("Failed to save history:", saveError);
        alert(
          "Analysis finished, but history was not saved. Please login with Google first."
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async (issue: SuggestedIssue) => {
    if (!repositoryRef) {
      alert("Please analyse a repository first.");
      return;
    }

    try {
      if (repositoryRef.source === "gitlab") {
        if (!repositoryRef.gitlabProjectId) {
          alert("GitLab project ID is missing.");
          return;
        }

        await createGitLabIssue(
          repositoryRef.gitlabProjectId,
          gitlabToken,
          issue.title,
          issue.description
        );

        alert("Issue created in GitLab!");
      }

      if (repositoryRef.source === "github") {
        if (!repositoryRef.githubOwner || !repositoryRef.githubRepo) {
          alert("GitHub repository information is missing.");
          return;
        }

        await createGitHubIssue(
          repositoryRef.githubOwner,
          repositoryRef.githubRepo,
          githubToken,
          issue.title,
          issue.description
        );

        alert("Issue created in GitHub!");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create issue.");
    }
  };

  return (
    <main className="app">
      <section className="hero-section">
        <div className="hero-badge">AI Repository Assistant</div>

        <h1>
          <span>Learn at your level.</span>
        </h1>
      </section>

      <section className="content-grid">
        <div className="form-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Repository input</p>
              <h2>Analyse a project</h2>
            </div>

            <div className="status-pill">
              {loading ? "Running" : projectId ? "Ready" : "Idle"}
            </div>
          </div>

          <label className="input-group">
            <span>Repository source</span>
            <select
              value={source}
              onChange={(e) => {
                const nextSource = e.target.value as RepositorySource;
                setSource(nextSource);

                if (nextSource === "github" && repoUrl.includes("gitlab.com")) {
                  setRepoUrl("");
                }

                if (nextSource === "gitlab" && repoUrl.includes("github.com")) {
                  setRepoUrl("");
                }
              }}
            >
              <option value="gitlab">GitLab</option>
              <option value="github">GitHub</option>
            </select>
          </label>

          <label className="input-group">
            <span>{platformName} repository URL</span>
            <input
              placeholder={
                source === "github"
                  ? "https://github.com/owner/repository"
                  : "https://gitlab.com/group/project"
              }
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </label>

          <div className="settings-grid">
            <label className="input-group">
              <span>Explanation language</span>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  localStorage.setItem("explanationLanguage", e.target.value);
                }}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="input-group">
              <span>Technology level</span>
              <div className="star-selector" aria-label="Technology level">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={level <= techLevel ? "star active" : "star"}
                    onClick={() => {
                      setTechLevel(level);
                      localStorage.setItem("technologyLevel", String(level));
                    }}
                    aria-label={`Technology level ${level}`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <p className="level-helper">
                {techLevel}/5 · {levelDescriptions[techLevel]}
              </p>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={analyseRepo}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Analysing repository...
              </>
            ) : (
              `Analyse ${platformName} Repository`
            )}
          </button>
        </div>

        <aside className="preview-card">
          <p className="eyebrow">What you get</p>
          <h2>Personalised explanation + actionable issues</h2>

          <div className="feature-list">
            <div>
              <span className="feature-icon">🌐</span>
              <p>Choose GitLab or GitHub repository analysis</p>
            </div>

            <div>
              <span className="feature-icon">🌐</span>
              <p>Choose the language for the project explanation</p>
            </div>

            <div>
              <span className="feature-icon">⭐</span>
              <p>Choose 1–5 stars for the technology level</p>
            </div>

            <div>
              <span className="feature-icon">✅</span>
              <p>Get five suggested issues with clear fix steps</p>
            </div>
          </div>
        </aside>
      </section>

      {explanation && (
        <section className="result-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">AI result</p>
              <h2>Repository Explanation</h2>
            </div>

            <div className="result-tags">
              <span>{platformName}</span>
              <span>{selectedLanguage.label}</span>
              <span>
                {"⭐".repeat(techLevel)} {techLevel}/5
              </span>
            </div>
          </div>

          <pre className="analysis-box">{explanation}</pre>
        </section>
      )}

      {issues.length > 0 && (
        <section className="result-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Suggested work</p>
              <h2>{platformName} Issues</h2>
            </div>
          </div>

          <div className="issue-grid">
            {issues.map((issue, index) => (
              <article className="issue-card" key={`${issue.title}-${index}`}>
                <div className="issue-number">
                  Issue {String(index + 1).padStart(2, "0")}
                </div>

                <h3>{issue.title}</h3>
                <p>{issue.description}</p>

                <button
                  className="secondary-button"
                  onClick={() => handleCreateIssue(issue)}
                >
                  Create Issue in {platformName}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;