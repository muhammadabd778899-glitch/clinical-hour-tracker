import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg text-center">
      <PageHeader title="Page not found" />
      <p className="text-sm text-app-muted">
        The page you are looking for does not exist. Your saved records are safe — try one of the links below.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn-primary">
          Overview
        </Link>
        <Link to="/activities" className="btn-secondary">
          Activity Log
        </Link>
        <Link to="/settings" className="btn-secondary">
          Settings &amp; Help
        </Link>
      </div>
    </div>
  );
}
