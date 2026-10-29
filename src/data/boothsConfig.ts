import type { BoothConfig } from '../types';
import { BOOTH_QUESTION_GENERATORS } from '../utils/questionEngine';

export const TOTAL_BOOTHS = 9;
export const REQUIRED_BOOTHS_TO_WIN = 4;
export const MAX_BOOTHS_PER_PARTICIPANT = 4;

const boothDetails: Array<Pick<BoothConfig, 'number' | 'title' | 'category' | 'badge' | 'description'>> = [
  { number: 1, title: 'Data Governance, Lineage & Zero Trust', category: 'Data & Security', badge: 'DATA GOVERNANCE', description: 'Explore trusted data, privacy, lineage, and modern zero-trust security.' },
  { number: 2, title: 'Autonomous Agents, Digital Identity & Next-Gen Banking', category: 'Agentic AI & Identity', badge: 'AUTONOMOUS AGENTS', description: 'Discover intelligent agents, digital identity, and safer banking experiences.' },
  { number: 3, title: 'AI-Powered Software Engineering & Developer Productivity', category: 'Software Engineering', badge: 'AI ENGINEERING', description: 'See how AI improves developer workflows, quality, and delivery speed.' },
  { number: 4, title: 'Cloud Modernization & Data Platforms', category: 'Cloud & Modernization', badge: 'CLOUD MODERNIZATION', description: 'Learn how modern platforms transform legacy systems and data estates.' },
  { number: 5, title: 'Enterprise AI Platform & Intelligent AI Operations', category: 'Enterprise AI & MLOps', badge: 'ENTERPRISE AI', description: 'Explore responsible AI operations, model routing, and platform intelligence.' },
  { number: 6, title: 'AI Business Intelligence & Process Automation', category: 'Business Automation', badge: 'AI AUTOMATION', description: 'Turn business data and everyday processes into intelligent outcomes.' },
  { number: 7, title: 'Agentic Banking, Risk Intelligence & AI Teammates', category: 'Risk & Banking', badge: 'RISK INTELLIGENCE', description: 'Experience explainable risk intelligence and human-centered AI teammates.' },
  { number: 8, title: 'Intelligent Enterprise Platforms & SRE Operations', category: 'Enterprise Platforms & SRE', badge: 'SRE OPERATIONS', description: 'Discover resilient enterprise platforms and self-healing operations.' },
  { number: 9, title: 'AI-Accelerated Engineering, Automation & Quality', category: 'Modernization & Quality', badge: 'QUALITY IQ', description: 'Learn how intelligent automation helps teams ship reliable software.' },
];

export const BOOTHS: BoothConfig[] = boothDetails.map((details) => ({
  ...details,
  id: `booth-${details.number}`,
  icon: `booth-${details.number}`,
  questions: BOOTH_QUESTION_GENERATORS[`booth-${details.number}`](50),
}));

export function getBoothById(value?: string | number | null): BoothConfig | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).toLowerCase().trim();
  const number = normalized.replace(/[^0-9]/g, '');
  return BOOTHS.find((booth) => booth.id === normalized || String(booth.number) === number) ?? null;
}
