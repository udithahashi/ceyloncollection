import type { Metadata } from 'next';
import { ArrowRight, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { readTheme } from '@/lib/theme/cookie';
import { themes } from '@/lib/theme/tokens';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * A single headline number. Shows a dash rather than a zero while there is no
 * data: zero is a measurement, and claiming one before any lead exists would be
 * a small lie that undermines every other number on the page.
 */
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="eyebrow text-xs text-ink-secondary">{label}</p>
        {/* Tabular figures, so a column of these lines up digit for digit. */}
        <p className="numeric text-2xl font-semibold text-ink-primary">{value}</p>
        <p className="text-xs text-ink-secondary">{note}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const themeName = await readTheme();
  const theme = themes[themeName];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Demand signals from social media, in one place. The database is connected but empty - lead capture arrives next, and every number here fills in once the first enquiry is recorded."
        actions={
          <Button variant="primary" disabled>
            <Plus aria-hidden="true" />
            New lead
          </Button>
        }
      />

      <section aria-labelledby="signals" className="flex flex-col gap-3">
        <h2 id="signals" className="eyebrow text-sm text-ink-secondary">
          This week
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="New enquiries" value="—" note="Awaiting first lead" />
          <Metric label="Ready to buy" value="—" note="Awaiting first lead" />
          <Metric label="Repeat customers" value="—" note="Awaiting first lead" />
          <Metric label="Top sub-category" value="—" note="Needs 10+ leads" />
        </div>
      </section>

      <section aria-labelledby="foundations" className="flex flex-col gap-3">
        <h2 id="foundations" className="eyebrow text-sm text-ink-secondary">
          Design foundations
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardEyebrow>Typography</CardEyebrow>
                <CardTitle>Inter, at four weights</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <p className="text-xl font-semibold text-ink-primary">Leads by sub-category</p>
                <p className="text-xs text-ink-secondary">
                  Semibold 600 · headings and card titles
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm text-ink-primary">
                  Hand-selected fabrics from Sri Lankan mills, sized and priced for families in
                  Qatar who know the difference after the second wash.
                </p>
                <p className="text-xs text-ink-secondary">
                  Regular 400 · body copy and table cells
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="eyebrow text-[0.8125rem] text-ink-primary">Contact number</p>
                <p className="text-xs text-ink-secondary">
                  Medium 500 · field labels, column headers, buttons
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="numeric text-xl font-semibold text-ink-primary">1,248 · 07 · 0974</p>
                <p className="text-xs text-ink-secondary">
                  Tabular figures, so digits stay in column
                </p>
              </div>

              <p className="border-t border-line-subtle pt-4 text-xs text-ink-secondary">
                The brand pairing — Cormorant Garamond, Jost and Marcellus — is reserved for the
                public site. A tool you work in all day is easier to read in a face designed for
                interfaces.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardEyebrow>Currently {themeName.replace('admin-', '')}</CardEyebrow>
                <CardTitle>Chart series</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CardDescription>
                Each series steps about a fifth in brightness from the last, so the eight are still
                separable in a greyscale print or to someone who cannot distinguish red from green.
              </CardDescription>

              <ul className="flex flex-col gap-1.5">
                {theme.chart.map((colour, index) => (
                  <li key={colour} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-6 rounded-control border border-line-subtle"
                      style={{ backgroundColor: colour, width: `${25 + index * 9}%` }}
                    />
                    <span className="numeric text-xs text-ink-secondary">{colour}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardEyebrow>Components</CardEyebrow>
                <CardTitle>Actions and status</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">
                  Ghost
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button variant="danger" size="sm">
                  Delete
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Hot lead</Badge>
                <Badge tone="success">Delivered</Badge>
                <Badge tone="info">Sourcing</Badge>
                <Badge tone="warning">On hold</Badge>
                <Badge tone="error">Lost</Badge>
                <Badge>New inquiry</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardEyebrow>Components</CardEyebrow>
                <CardTitle>Form fields</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <TextField
                name="contactNumber"
                label="Contact number"
                hint="Stored in E.164 form, which is how one customer's enquiries are linked together."
                placeholder="+974 3312 4455"
                inputMode="tel"
                required
              />

              <SelectField
                name="area"
                label="City or area"
                error="Choose the area this enquiry came from."
                defaultValue=""
              >
                <option value="" disabled>
                  Select an area
                </option>
                <option>Doha</option>
                <option>Al Rayyan</option>
                <option>Al Wakrah</option>
              </SelectField>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled>
                Save lead
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>
    </>
  );
}
