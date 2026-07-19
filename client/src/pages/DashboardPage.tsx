import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Plus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { AddResultDialog } from '@/components/AddResultDialog';
import { AiUploadDialog } from '@/components/AiUploadDialog';
import { fmtDate, fmtNum, flagColor, flagLabel } from '@/lib/format';

export function DashboardPage() {
  const { data: cards, isLoading } = useQuery({ queryKey: ['overview'], queryFn: api.overview });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Мої показники</h1>
          <p className="text-sm text-muted">Динаміка аналізів і референсні межі в одному місці</p>
        </div>
        <div className="flex gap-2">
          <AiUploadDialog trigger={<Button variant="outline"><Camera size={17} /> З фото</Button>} />
          <AddResultDialog trigger={<Button><Plus size={17} /> Додати значення</Button>} />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Завантаження…</p>}

      {!isLoading && cards?.length === 0 && (
        <Card className="p-10 text-center">
          <TrendingUp className="mx-auto mb-3 text-primary" />
          <p className="font-medium">Тут поки порожньо</p>
          <p className="mt-1 text-sm text-muted">
            Додайте перше значення вручну або сфотографуйте бланк аналізів.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards?.map((c, i) => {
          const fc = flagColor(c.latest.flag);
          return (
            <motion.div
              key={c.biomarker.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link to={`/b/${c.biomarker.slug}`}>
                <Card className="p-5 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      {c.biomarker.category && (
                        <span className="text-[11px] uppercase tracking-wide text-muted">{c.biomarker.category}</span>
                      )}
                      <h3 className="truncate font-medium">{c.biomarker.shortName ?? c.biomarker.name}</h3>
                    </div>
                    <Badge className={`${fc.bg} ${fc.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${fc.dot}`} />
                      {flagLabel[c.latest.flag]}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="tabnums font-display text-3xl font-bold">
                      {fmtNum(c.latest.value, c.biomarker.precision)}
                    </span>
                    <span className="text-sm text-muted">{c.latest.unit}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{fmtDate(c.latest.measuredAt)}</span>
                    {c.reference?.low != null && c.reference?.high != null && (
                      <span>норма {c.reference.low}–{c.reference.high}</span>
                    )}
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
