// How each member voted on one agenda item. Every row is built the same way: no member, including the builder,
// is marked, ordered or styled differently (Global Constraints). Order is the caller's (name order).
export function VoteTable({ votes }: { votes: { personId: number; name: string; value: string }[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="mb-1 text-left font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">HOW MEMBERS VOTED</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Member</th>
          <th scope="col">Vote</th>
        </tr>
      </thead>
      <tbody>
        {votes.map((v) => (
          <tr key={v.personId}>
            <td className="border-b border-map py-2">{v.name}</td>
            <td className="border-b border-map py-2 text-right font-bold">{v.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
