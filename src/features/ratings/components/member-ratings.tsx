import { Avatar } from "@/components/ui/avatar";
import { formatScore } from "@/lib/format";
import { personalAverage } from "../scores";
import type { MemberRating } from "../types";

/** Everyone's grades for a film, members who have not rated included. */
export function MemberRatings({ ratings }: { ratings: MemberRating[] }) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-2 text-left text-[13px] font-semibold text-muted">Les notes de la room</caption>
      <thead>
        <tr className="text-[11px] font-semibold text-muted">
          <th scope="col" className="text-left font-semibold">
            <span className="sr-only">Membre</span>
          </th>
          <th scope="col" className="w-10 font-semibold">
            <abbr title="Humour">Hum.</abbr>
          </th>
          <th scope="col" className="w-10 font-semibold">
            <abbr title="Scénario">Scén.</abbr>
          </th>
          <th scope="col" className="w-11 font-semibold">
            <abbr title="Jeu d'acteur, bonus">Bonus</abbr>
          </th>
          <th scope="col" className="w-10 text-right font-semibold">
            <abbr title="Moyenne">Moy.</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {ratings.map(({ userId, pseudo, scores }) => (
          <tr key={userId} className="border-t border-[#f0f0ee]">
            <th scope="row" className="py-2.5 text-left font-semibold">
              <span className="flex items-center gap-2.5">
                <Avatar id={userId} pseudo={pseudo} size="sm" />
                <span aria-hidden="true">{pseudo}</span>
              </span>
            </th>
            {scores ? (
              <>
                <td className="text-center">{scores.humour}</td>
                <td className="text-center">{scores.scenario}</td>
                <td className="text-center text-muted">{scores.acting ?? "—"}</td>
                <td className="text-right font-extrabold">{formatScore(personalAverage(scores))}</td>
              </>
            ) : (
              <td colSpan={4} className="text-right text-xs text-muted">
                pas encore noté
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
