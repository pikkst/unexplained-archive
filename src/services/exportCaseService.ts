import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CaseData {
  id: string;
  title: string;
  description: string;
  detailed_description?: string;
  category: string;
  location?: string;
  status: string;
  difficulty_rating?: number;
  progress_percentage?: number;
  reward_amount: number;
  created_at: string;
  submitter?: {
    username: string;
  };
  team_members?: Array<{
    username: string;
    role: string;
  }>;
  evidence?: Array<{
    url: string;
    description?: string;
    created_at: string;
  }>;
  comments?: Array<{
    content: string;
    user?: {
      username: string;
    };
    created_at: string;
  }>;
}

export const exportCaseService = {
  /**
   * Export case as PDF
   */
  exportToPDF: async (caseData: CaseData): Promise<void> => {
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(caseData.title, 20, yPos);
    yPos += 10;

    // Case Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Case ID: ${caseData.id}`, 20, yPos);
    yPos += 6;
    doc.text(`Category: ${caseData.category}`, 20, yPos);
    yPos += 6;
    doc.text(`Status: ${caseData.status}`, 20, yPos);
    yPos += 6;
    if (caseData.location) {
      doc.text(`Location: ${caseData.location}`, 20, yPos);
      yPos += 6;
    }
    if (caseData.difficulty_rating) {
      doc.text(`Difficulty: ${'⭐'.repeat(caseData.difficulty_rating)}`, 20, yPos);
      yPos += 6;
    }
    if (caseData.progress_percentage !== undefined) {
      doc.text(`Progress: ${caseData.progress_percentage}%`, 20, yPos);
      yPos += 6;
    }
    doc.text(`Reward: $${caseData.reward_amount}`, 20, yPos);
    yPos += 6;
    doc.text(`Submitted by: ${caseData.submitter?.username || 'Unknown'}`, 20, yPos);
    yPos += 6;
    doc.text(
      `Date: ${new Date(caseData.created_at).toLocaleDateString()}`,
      20,
      yPos
    );
    yPos += 10;

    // Description
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const descriptionLines = doc.splitTextToSize(caseData.description, 170);
    doc.text(descriptionLines, 20, yPos);
    yPos += descriptionLines.length * 6 + 5;

    // Detailed Description
    if (caseData.detailed_description) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Description', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const detailedLines = doc.splitTextToSize(
        caseData.detailed_description,
        170
      );
      doc.text(detailedLines, 20, yPos);
      yPos += detailedLines.length * 6 + 10;
    }

    // Team Members
    if (caseData.team_members && caseData.team_members.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Investigation Team', 20, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Username', 'Role']],
        body: caseData.team_members.map((member) => [
          member.username,
          member.role,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Evidence
    if (caseData.evidence && caseData.evidence.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Evidence', 20, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['URL', 'Description', 'Date']],
        body: caseData.evidence.map((ev) => [
          ev.url,
          ev.description || 'N/A',
          new Date(ev.created_at).toLocaleDateString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55] },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 80 },
          2: { cellWidth: 40 },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Comments
    if (caseData.comments && caseData.comments.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Comments', 20, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['User', 'Comment', 'Date']],
        body: caseData.comments.map((comment) => [
          comment.user?.username || 'Unknown',
          comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
          new Date(comment.created_at).toLocaleDateString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 100 },
          2: { cellWidth: 40 },
        },
      });
    }

    // Save PDF
    const fileName = `case-${caseData.id}-${Date.now()}.pdf`;
    doc.save(fileName);
  },

  /**
   * Export case as JSON
   */
  exportToJSON: (caseData: CaseData): void => {
    const jsonString = JSON.stringify(caseData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `case-${caseData.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Export case as plain text
   */
  exportToText: (caseData: CaseData): void => {
    let text = `=== CASE REPORT ===\n\n`;
    text += `Title: ${caseData.title}\n`;
    text += `Case ID: ${caseData.id}\n`;
    text += `Category: ${caseData.category}\n`;
    text += `Status: ${caseData.status}\n`;
    if (caseData.location) text += `Location: ${caseData.location}\n`;
    if (caseData.difficulty_rating)
      text += `Difficulty: ${caseData.difficulty_rating}/5\n`;
    if (caseData.progress_percentage !== undefined)
      text += `Progress: ${caseData.progress_percentage}%\n`;
    text += `Reward: $${caseData.reward_amount}\n`;
    text += `Submitted by: ${caseData.submitter?.username || 'Unknown'}\n`;
    text += `Date: ${new Date(caseData.created_at).toLocaleString()}\n\n`;

    text += `=== DESCRIPTION ===\n${caseData.description}\n\n`;

    if (caseData.detailed_description) {
      text += `=== DETAILED DESCRIPTION ===\n${caseData.detailed_description}\n\n`;
    }

    if (caseData.team_members && caseData.team_members.length > 0) {
      text += `=== INVESTIGATION TEAM ===\n`;
      caseData.team_members.forEach((member) => {
        text += `- ${member.username} (${member.role})\n`;
      });
      text += '\n';
    }

    if (caseData.evidence && caseData.evidence.length > 0) {
      text += `=== EVIDENCE ===\n`;
      caseData.evidence.forEach((ev, index) => {
        text += `${index + 1}. ${ev.url}\n`;
        if (ev.description) text += `   Description: ${ev.description}\n`;
        text += `   Date: ${new Date(ev.created_at).toLocaleString()}\n\n`;
      });
    }

    if (caseData.comments && caseData.comments.length > 0) {
      text += `=== COMMENTS (${caseData.comments.length}) ===\n`;
      caseData.comments.forEach((comment) => {
        text += `\n[${comment.user?.username || 'Unknown'}] ${new Date(
          comment.created_at
        ).toLocaleString()}\n`;
        text += `${comment.content}\n`;
      });
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `case-${caseData.id}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
