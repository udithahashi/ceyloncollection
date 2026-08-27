# Ceylon Collection — the business

**What this document is.** A standing briefing on the business itself, written so it can
be handed to an AI assistant (or a new person) instead of explaining everything again.
It describes the _business_, not the codebase — for the software, read
[docs/HANDOVER.md](HANDOVER.md) and [docs/CONCEPTS.md](CONCEPTS.md).

**How to use it.** Everything under "Not settled yet" is genuinely undecided. Ask the
owner; do not fill it in with a plausible-sounding invention. That rule is the whole
reason this house's website still says `___` where a discount figure would go — an
invented fact is worse than a blank one, because nobody can tell it is invented later.

Last reviewed: 2026-08-24.

---

## In one paragraph

Ceylon Collection is a small clothing import business run by one person, Hashi, from
Qatar. It selects Sri Lankan clothing — batik, handloom-adjacent cotton, flower frocks,
office wear — in Sri Lanka, brings it over as a whole edit rather than a warehouse, and
sells it to customers in Qatar through social media and WhatsApp conversations. There is
no shop, no checkout and no basket. The transaction is a conversation. The business runs
on a private back office that captures those conversations as leads, turns repeat buyers
into customers, and reports on what people actually ask for.

## Fast facts

|                    |                                                                    |
| ------------------ | ------------------------------------------------------------------ |
| Name               | Ceylon Collection                                                  |
| Owner / operator   | Hashi — solo; does the sourcing, the selling and the software      |
| Base of operations | Qatar (Asia/Qatar, UTC+3)                                          |
| Sourcing country   | Sri Lanka (Asia/Colombo, UTC+5:30)                                 |
| Sector             | Clothing import and retail — women's and men's                     |
| Sales model        | Social-media led, consultative, closed on WhatsApp. No checkout    |
| Public site        | Brand and catalogue only — it creates enquiries, it takes no money |
| Working languages  | English, with Sinhala as a brand accent (`අපේ කම` — "our way")     |
| Stage              | Trading; the supporting software is roughly two-thirds built       |

## What it sells

Six edits, described the way the house describes them:

- **Flower frocks** — printed cotton dresses, the everyday centre of the range.
- **Batik & sarong** — wax-resist indigo, both women's pieces and men's wraps.
- **Women's cotton** — knits and light layers for the heat.
- **Men's cotton** — tees and casual pieces with enough weight to hang properly.
- **Women's office** — workwear cut for the climate.
- **Men's office** — shirts and sets that survive the walk in.

Individual pieces carry names, not SKU codes — Nimali frock, Kandy garden, Indigo wax
sarong, Galle wax frock, Harbour tee, Fort tee, Colombo set, Pettah shirt. The edit is
short and it moves; nothing shown publicly is a promise about a shelf.

The through-line across all six: **cloth that holds the heat, colour that already feels
familiar, a cut for the life the customer lives now.**

## Who buys

Two overlapping groups, and the copy is written for both at once:

1. **Sri Lankans living in Qatar.** They already know this clothing and already trust
   it. They are not being introduced to anything — they are being reached. The only
   useful thing to tell them is that they can have it again.
2. **Anyone who wants clothing with a point of view.** For them the same pieces read as
   discovery rather than recognition.

The premise the whole brand rests on: **clothing made for the Sri Lankan domestic market
rarely leaves it, and no amount of searching from abroad changes that. Distance is the
only thing standing between the customer and it.** The business closes that distance.

Enquiries are captured with the customer's city, size, gender, fabric preference,
category, urgency and the platform they arrived from — which is what the analytics side
exists to read.

## How it actually works

1. **Select.** Pieces are chosen by hand in Sri Lanka, against the standard a person who
   grew up with that wardrobe would apply — cloth, cut, finish.
2. **Carry over.** An edit is brought across whole, not shipped piece by piece. Some of
   what is shown publicly belongs to an edit still to come; the house says so plainly
   rather than take an order against a date it cannot promise.
3. **Show.** Instagram and Facebook carry the pieces; the website is the fuller
   catalogue and the brand's own ground.
4. **Talk.** Every enquire link opens WhatsApp with the piece already named. The reply
   covers what is in stock, in which sizes, and what it costs. Nothing is charged on the
   website and no card details are ever entered there.
5. **Record.** The conversation becomes a lead in the back office, keyed on the phone
   number, so a returning customer is never asked the same questions twice.
6. **Deliver.** Arranged inside the same conversation the order was made in, once the
   edit has landed.
7. **Follow up.** Returns and exchanges start in that same WhatsApp thread — it already
   carries the piece, the size and the date.

**Why there is no basket.** Deliberate, not unfinished. The edit is small and moves
quickly, so a stock badge would be a promise the house cannot keep. The conversation
also answers what a size chart cannot: how the cloth sits in the heat, whether a cut
runs long, what else came over in the same cotton.

## The brand, and the lines it will not cross

The identity is editorial and restrained — Sinhala accent, wide uppercase labels, square
corners, generous white space, real photography. The tone is plain and adult: it speaks
from inside the customer's own knowledge rather than selling at them.

Four rules the copy holds to. These matter most when an AI is asked to write in the
brand's voice, because all four are exactly what a generic fashion generator reaches for
by default:

- **No craft romance.** No artisans, looms, wax vats or heritage storytelling as
  decoration. This house does not weave anything — it _chooses_ cloth other people made
  and carries it to Qatar. The verb is "chosen".
- **No price framing.** The reason the business exists is access, not a discount.
  Framing it as the cheaper option insults the customer and undersells the clothes.
- **No competitor named or ranked.** "It does not travel" is a fact about distance, not
  a swipe at what is on the shelves locally.
- **No invented numbers, offers or claims.** Figures are counted from real data or left
  blank. A discount is a promise; it does not go on the site until the business has
  decided it can keep it.

## Systems behind it

- **Back office** (private, invite-only): leads, customers, taxonomy, lead photos,
  spreadsheet import, activity log.
- **Automated intake**: n8n on the same server captures social leads into a review queue
  rather than writing straight to the customer record.
- **Analytics**: one board per subject. Demand is built. Money, stock and orders are
  declared and planned, not built.
- **Identity**: the phone number in E.164 is the customer key — the same person across
  Instagram, Facebook and WhatsApp.

## Where it is going

In rough priority order: real brand assets from the human designer now hired; finishing
the public site's photography and signing off its visual design; then the commercial
modules — **money** (costs, margins, what an edit actually earned), **stock** (what came
over, what is left), and **orders** (turning a closed conversation into a recorded sale).

## Not settled yet — ask, do not invent

- Legal status: whether the business is registered in Qatar (trade name, CR), in
  Sri Lanka, or trading informally.
- Year founded, and how many years of edits have been brought over.
- The real WhatsApp number and the real Instagram / Facebook handles — the code still
  carries placeholders.
- Sourcing relationships: named suppliers and markets, or family and personal trips.
- Delivery specifics: areas covered, whether anywhere outside Qatar is served, how long
  it takes, what it costs, any order size that waives it.
- Returns specifics: the window, the condition required, who pays return carriage,
  whether exchanges are offered, and how altered or made-to-measure pieces are treated.
- Pricing and payment: how prices are set, and how money is actually taken today.
