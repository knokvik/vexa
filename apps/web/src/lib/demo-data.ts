import type { ApplicationDraft, JobListing, Profile } from "@vexa/shared";

export const DEMO_USER_ID = "user_demo_1";

/**
 * Profile content from user's sample resume (Resume.docx / Resume.pdf).
 * Format: Education → Experience → Skills → Projects → Interests / Personal.
 */
export const DEMO_PROFILE: Profile = {
  id: "profile_demo_1",
  userId: DEMO_USER_ID,
  fullName: "Niraj Naphade",
  headline: "Developer · Performance Engineering & High Frequency Systems",
  summary:
    "Currently learning Performance Engineering and High Frequency Systems. Building low-latency systems, market microstructure tools, and hybrid search engines.",
  location: "Pune, Maharashtra, India – 411062",
  phone: "+91 8767374879",
  email: "neerajnaphade02@gmail.com",
  linkedinUrl: "https://www.linkedin.com/in/niraj-naphade",
  githubUrl: "https://github.com/knokvik",
  preferredLocations: ["Pune", "Remote", "India"],
  preferredIndustries: ["Fintech", "Trading Systems", "AI Infrastructure"],
  yearsExperience: 1,
  skills: [
    {
      id: "s1",
      name: "C++",
      proficiency: "advanced",
      category: "technical",
    },
    {
      id: "s2",
      name: "Python",
      proficiency: "advanced",
      category: "technical",
    },
    {
      id: "s3",
      name: "TypeScript",
      proficiency: "advanced",
      category: "technical",
    },
    {
      id: "s4",
      name: "USearch",
      proficiency: "intermediate",
      category: "technical",
    },
    {
      id: "s5",
      name: "Machine Learning",
      proficiency: "intermediate",
      category: "technical",
    },
    {
      id: "s6",
      name: "RocksDB",
      proficiency: "intermediate",
      category: "technical",
    },
    {
      id: "s7",
      name: "React",
      proficiency: "intermediate",
      category: "tool",
    },
    {
      id: "s8",
      name: "Flutter",
      proficiency: "intermediate",
      category: "tool",
    },
    {
      id: "s9",
      name: "Docker",
      proficiency: "intermediate",
      category: "tool",
    },
  ],
  experiences: [
    {
      id: "e1",
      company: "Barspell Technology",
      title: "Developer",
      location: "Pune, Maharashtra",
      startDate: "2024-06",
      endDate: "2024-08",
      isCurrent: false,
      description:
        "For my developer internship at Barspell Technologies, I created a Flutter mobile application with real-time inventory stock tracking, entries, and an automated receipt system; I built a Web front end with a built-in scan feature designed to track stock with real-time tracking; and I wrote the backend API server. It enabled all three of the roles of the companies to be signed in, carry out their respective tasks, and monitor their operations.",
      achievements: [],
    },
  ],
  education: [
    {
      id: "ed1",
      school: "MIT Academy of Engineering, Pune",
      degree: "BTech",
      field: "Electronics & Telecommunications",
      location: "Pune, Maharashtra",
      endDate: "2028",
      gpa: "8.55",
    },
    {
      id: "ed2",
      school: "Pimpri Chinchwad Polytechnic, Pune",
      degree: "Diploma",
      field: "Information Technology",
      location: "Pune, Maharashtra",
      endDate: "2025",
      gpa: "9.19",
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Quark",
      description:
        "Designed and implemented a high-performance limit order book (LOB) matching engine in C++20, optimized for microsecond-level latency and high-throughput market data processing.",
      technologies: ["C++20"],
    },
    {
      id: "p2",
      name: "Avellaneda Stoikov Market Making Simulator",
      description:
        "Built backtesting framework to simulate P&L, inventory risk, and adverse selection under various market conditions.",
    },
    {
      id: "p3",
      name: "Cross Sectional Alpha Research Framework",
      description:
        "Implemented risk-adjusted performance metrics, multiple testing corrections, and out-of-sample validation to minimize false discovery.",
    },
    {
      id: "p4",
      name: "Tradabilitygap (Liquidity & Execution Gap Model)",
      description:
        "Applied statistical methods to identify optimal execution windows and size constraints for large orders.",
    },
    {
      id: "p5",
      name: "VisionKV",
      description:
        "A vLLM plugin for Vision-Language Models (VLMs) that dynamically evicts vision key-value (KV) cache blocks to CPU memory once the model stops attending to them during text generation. (Working)",
      technologies: ["vLLM", "Python"],
    },
    {
      id: "p6",
      name: "Kestral",
      description:
        "Building an Ultra Low-Latency Real-Time Document Ingestion & Hybrid Search Engine. Goals: Ingest 100000+ documents per second | Support 50-100 million documents | Deliver hybrid search (keyword + vector) with less than 50ms.",
    },
  ],
  leadership: [],
  certifications: [],
  languages: ["English", "Hindi", "Marathi"],
  interests: [
    "Currently I am working in learning Performance Engineering and High Frequency Systems.",
  ],
  templatePriorities: [
    "tpl-harvard",
    "tpl-mit",
    "tpl-princeton",
    "tpl-penn",
    "tpl-yale",
  ],
};

export const DEMO_JOBS: JobListing[] = [
  {
    id: "job_1",
    source: "demo",
    externalUrl: "https://boards.greenhouse.io/example/jobs/1",
    title: "Software Engineer",
    company: "Stripe",
    location: { city: "Remote", country: "US", remote: true },
    description:
      "Build low-latency systems. C++, Python, distributed systems experience preferred.",
    requirements: ["C++ or Python", "Systems programming"],
    responsibilities: ["Ship production systems"],
    skillsRequired: ["C++", "Python", "TypeScript"],
    employmentType: "full-time",
    experienceLevel: "entry",
    status: "active",
    scrapedAt: new Date().toISOString(),
  },
  {
    id: "job_2",
    source: "demo",
    externalUrl: "https://jobs.lever.co/example/abc",
    title: "Backend Engineer",
    company: "Figma",
    location: { city: "San Francisco", state: "CA", remote: false },
    description: "Backend services, APIs, performance.",
    requirements: [],
    responsibilities: [],
    skillsRequired: ["TypeScript", "React", "Node"],
    employmentType: "full-time",
    experienceLevel: "mid",
    status: "active",
    scrapedAt: new Date().toISOString(),
  },
];

export const DEMO_DRAFTS: ApplicationDraft[] = [];
