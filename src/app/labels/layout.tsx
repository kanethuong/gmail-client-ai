import InboxLayout from '../inbox/layout';

interface LabelsLayoutProps {
  children: React.ReactNode;
}

export default function LabelsLayout({ children }: LabelsLayoutProps) {
  return <InboxLayout>{children}</InboxLayout>;
}