import { useRoute } from 'vue-router'
import { getGitlabUrl, getGitlabProjectPath } from '@/config/runtime'

export type IssueType = 'bug' | 'feature'

const TEMPLATES: Record<IssueType, string> = {
  bug: `## Steps to reproduce


## Expected behavior


## Actual behavior

`,
  feature: `## Problem


## Proposed solution

`,
}

const LABELS: Record<IssueType, string> = {
  bug: 'bug',
  feature: 'feature',
}

export function useGitlabIssue() {
  const route = useRoute()

  function buildIssueUrl(type: IssueType): string {
    const gitlabUrl = getGitlabUrl().replace(/\/$/, '')
    const projectPath = getGitlabProjectPath()
    const description = `${TEMPLATES[type]}\n## Page\n\n\`${route.path}\`\n\n## Environment\n\n\`${navigator.userAgent}\`\n`

    const params = new URLSearchParams()
    params.set('issue[title]', '')
    params.set('issue[description]', description)
    params.append('issue[label_names][]', LABELS[type])

    return `${gitlabUrl}/${projectPath}/-/issues/new?${params.toString()}`
  }

  function openIssue(type: IssueType): void {
    window.open(buildIssueUrl(type), '_blank')
  }

  return { buildIssueUrl, openIssue }
}
