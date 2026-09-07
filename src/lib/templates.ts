import { uid } from './id'
import { autoLayout } from './layout'
import type { FolderId, MapNode, MindMap } from '../types'

function node(title: string, note: string, parentId: string | null, t: number): MapNode {
  return { id: uid(), parentId, title, note, x: 0, y: 0, createdAt: t }
}

function build(title: string, folder: FolderId, pairs: { title: string; note?: string; parent: number }[]): MindMap {
  const now = Date.now()
  const nodes: MapNode[] = [node(title, '', null, now)]
  pairs.forEach((p, i) => {
    const parentId = p.parent === -1 ? nodes[0].id : nodes[p.parent + 1].id
    nodes.push(node(p.title, p.note ?? '', parentId, now + i + 1))
  })
  return {
    id: uid(),
    title,
    folder,
    nodes: autoLayout(nodes),
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  }
}

export const TEMPLATES = [
  {
    id: 'study',
    label: '학습 노트',
    desc: '개념 · 예시 · 질문',
    color: '#7c4dff',
    create: () =>
      build('학습 노트', 'drafts', [
        { title: '핵심 개념', parent: -1, note: '오늘 배운 가장 중요한 한 줄' },
        { title: '정의', parent: 0 },
        { title: '예시', parent: 0 },
        { title: '자주 하는 실수', parent: -1 },
        { title: '복습 질문', parent: -1 },
      ]),
  },
  {
    id: 'plan',
    label: '기획',
    desc: '목표 · 문제 · 다음 행동',
    color: '#2aa8a0',
    create: () =>
      build('기획안', 'projects', [
        { title: '목표', parent: -1 },
        { title: '문제', parent: -1 },
        { title: '해결 아이디어', parent: -1 },
        { title: '다음 행동', parent: -1 },
        { title: '리스크', parent: -1 },
      ]),
  },
  {
    id: 'reading',
    label: '독서 노트',
    desc: '핵심 · 인용 · 나의 생각',
    color: '#e09a2b',
    create: () =>
      build('독서 노트', 'drafts', [
        { title: '한 줄 요약', parent: -1 },
        { title: '핵심 주장', parent: -1 },
        { title: '인상 깊은 구절', parent: -1 },
        { title: '나의 생각', parent: -1 },
        { title: '적용할 점', parent: -1 },
      ]),
  },
  {
    id: 'project',
    label: '프로젝트',
    desc: '범위 · 할 일 · 결정',
    color: '#4b8adf',
    create: () =>
      build('프로젝트', 'projects', [
        { title: '범위', parent: -1 },
        { title: '할 일', parent: -1 },
        { title: '결정 사항', parent: -1 },
        { title: '열린 질문', parent: -1 },
      ]),
  },
] as const

export function welcomeMap(): MindMap {
  return build('MindFlow Lite 시작하기', 'inbox', [
    { title: '키보드', parent: -1, note: '노트북에서는 단축키로 빠르게 가지를 칩니다.' },
    { title: 'Enter 형제 노드', parent: 0 },
    { title: 'Tab 자식 노드', parent: 0 },
    { title: 'Ctrl+Z 실행 취소', parent: 0 },
    { title: '태블릿 / S Pen', parent: -1, note: '탭으로 선택, 더블 탭으로 편집, 드래그로 이동.' },
    { title: '두 손가락으로 이동·확대', parent: 4 },
    { title: '저장', parent: -1, note: '이 기기에 자동 저장됩니다. 서버와 로그인은 없습니다.' },
    { title: 'JSON으로 다른 기기에 옮기기', parent: 6 },
    { title: 'PNG로 보내기', parent: 6 },
  ])
}
