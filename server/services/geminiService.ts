import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export class GeminiSecurityService {
  public static async summarizeAlert(alert: any, relatedEvents: any[]): Promise<string> {
    const ai = getAiClient();
    if (!ai) {
      return `**AI Summary (Offline Mode)**:\n` +
        `Alert "${alert.title}" was triggered on asset **${alert.assetHostname || 'Unknown Host'}** with severity **${alert.severity}**.\n` +
        `• **Observed Evidence**: ${alert.evidence}\n` +
        `• **Telemetry Volume**: ${relatedEvents.length} related correlated event(s).\n` +
        `• **Recommended SOC Action**: ${alert.recommendedAction}`;
    }

    try {
      const prompt = `You are a Tier 3 SOC Security Analyst at PNGee CyberGuard (PNGee IT Solutions).
Summarize the following security alert concisely for an analyst:
Alert Title: ${alert.title}
Severity: ${alert.severity}
Asset: ${alert.assetHostname || 'N/A'}
User: ${alert.username || 'N/A'}
Evidence: ${alert.evidence}
Detection Rule: ${alert.detectionRuleName}
Correlated Events:
${JSON.stringify(relatedEvents.slice(0, 5), null, 2)}

Format your response strictly into 3 clear sections:
1. **Observed Facts**: What actually happened based on telemetry.
2. **Inferences & Threat Vector**: Potential impact (e.g. lateral movement, credential theft).
3. **Actionable Recommendations**: Next immediate steps for the analyst.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt
      });

      return response.text || 'Unable to generate AI alert summary.';
    } catch (err: any) {
      console.error('Gemini alert summarization error:', err);
      return `**Automated Analysis**: Alert involves ${alert.severity} event on ${alert.assetHostname || 'target host'}. Evidence: ${alert.evidence}. Immediate verification recommended.`;
    }
  }

  public static async generateIncidentSummary(incident: any): Promise<string> {
    const ai = getAiClient();
    if (!ai) {
      return `**Executive Incident Briefing**:\n` +
        `• **Incident**: ${incident.title} (${incident.severity})\n` +
        `• **Current Status**: ${incident.status}\n` +
        `• **Affected Systems**: ${incident.affectedAssetHostnames.join(', ') || 'N/A'}\n` +
        `• **Actions Taken**: ${incident.actionsTaken.join('; ') || 'Under active triage'}\n` +
        `• **Root Cause Analysis**: ${incident.rootCause || 'Under investigation'}`;
    }

    try {
      const prompt = `You are the Lead Incident Commander at PNGee CyberGuard (PNGee IT Solutions).
Provide a high-priority incident assessment briefing for the following security incident:
Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Affected Assets: ${incident.affectedAssetHostnames.join(', ')}
Timeline entries: ${JSON.stringify(incident.timeline)}
Evidence: ${JSON.stringify(incident.evidence)}
Actions Taken: ${JSON.stringify(incident.actionsTaken)}

Structure the response with:
- **Executive Summary**
- **Impact Assessment**
- **Containment & Remediation Playbook**
- **Lessons Learned & Preventative Controls**`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt
      });

      return response.text || 'Unable to generate AI incident summary.';
    } catch (err: any) {
      console.error('Gemini incident summary error:', err);
      return `Incident "${incident.title}" is currently in ${incident.status} status affecting ${incident.affectedAssetHostnames.length} asset(s).`;
    }
  }

  public static async queryAssistant(userQuery: string, orgContext: any): Promise<string> {
    const ai = getAiClient();
    if (!ai) {
      return `**PNGee CyberGuard SOC Copilot (Autonomous Offline Engine)**:\n` +
        `Based on telemetry for **${orgContext.orgName}**:\n` +
        `• Security Score: **${orgContext.posture.overallScore}/100** (Grade: ${orgContext.posture.grade})\n` +
        `• Active Critical Incidents: **${orgContext.incidents.filter((i: any) => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length}**\n` +
        `• Unresolved Alerts: **${orgContext.alerts.length}**\n` +
        `• Open Critical Vulnerabilities: **${orgContext.vulnerabilities.filter((v: any) => v.severity === 'CRITICAL').length}**\n` +
        `\n*Key Recommendation*: Prioritize patch updates for perimeter assets and complete active incident containment actions.`;
    }

    try {
      const prompt = `You are PNGee CyberGuard SOC AI Copilot, an enterprise-grade AI security analyst assisting customer administrators and SOC analysts for PNGee IT Solutions.
You have access ONLY to the authorized telemetry data for organization: "${orgContext.orgName}".

Current Organization Security Telemetry State:
- Overall Security Posture: ${orgContext.posture.overallScore}/100 (Grade: ${orgContext.posture.grade})
- Key Score Deductions: ${JSON.stringify(orgContext.posture.factors.flatMap((f: any) => f.deductions))}
- Active Incidents: ${JSON.stringify(orgContext.incidents.map((i: any) => ({ title: i.title, severity: i.severity, status: i.status })))}
- Recent Alerts: ${JSON.stringify(orgContext.alerts.slice(0, 5).map((a: any) => ({ title: a.title, severity: a.severity, evidence: a.evidence })))}
- Vulnerabilities: ${JSON.stringify(orgContext.vulnerabilities.map((v: any) => ({ cve: v.cveId, title: v.title, severity: v.severity, cvss: v.cvssScore })))}
- Backups: ${JSON.stringify(orgContext.backups.map((b: any) => ({ asset: b.protectedAssetName, status: b.status, rpo: b.recoveryPointStatus })))}
- Certificates: ${JSON.stringify(orgContext.certificates.map((c: any) => ({ domain: c.domain, daysRemaining: c.daysRemaining, status: c.status })))}

User Query: "${userQuery}"

Guidelines:
1. Clearly distinguish between **Observed Facts**, **Inferences**, and **Recommendations**.
2. Never hallucinate data outside this organization.
3. Be professional, concise, actionable, and cybersecurity-accurate (refer to CVEs, MITRE ATT&CK, or configurations where applicable).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt
      });

      return response.text || 'Unable to answer query at this time.';
    } catch (err: any) {
      console.error('Gemini copilot error:', err);
      return `Analyzing organization security state: Score is ${orgContext.posture.overallScore}/100. Please check active incidents and critical vulnerabilities in the dashboard.`;
    }
  }
}
