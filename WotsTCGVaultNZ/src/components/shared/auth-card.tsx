import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px] -z-10" />
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-2xl text-gold-gradient font-display font-bold">Wots TCG Vault</span>
        </Link>
        <div className="card-luxury p-8 animate-fade-up">
          <h1 className="text-2xl font-display font-bold text-center mb-1">{title}</h1>
          {subtitle && <p className="text-center text-sm text-muted mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
