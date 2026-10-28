import { redirect } from 'next/navigation'

// Os termos oficiais vivem no site institucional, para existir uma única versão.
export default function TermsPage() {
  redirect('https://smartskillshub.com.br/termos.html')
}
