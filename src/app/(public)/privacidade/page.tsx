import { redirect } from 'next/navigation'

// A política oficial vive no site institucional, para existir uma única versão.
export default function PrivacyPage() {
  redirect('https://smartskillshub.com.br/privacidade.html')
}
