import type { Guest } from "@/lib/types";

interface RsvpStatsProps {
  guests: Guest[];
}

export default function RsvpStats({ guests }: RsvpStatsProps) {
  const going = guests.filter((g) => g.rsvp_status === "going").length;
  const maybe = guests.filter((g) => g.rsvp_status === "maybe").length;
  const declined = guests.filter((g) => g.rsvp_status === "declined").length;
  const pending = guests.filter((g) => g.rsvp_status === "pending").length;
  const totalPlusOnes = guests.reduce((sum, g) => sum + g.plus_one_count, 0);

  const stats = [
    { label: "Going", value: going, color: "bg-green-100 text-green-700" },
    { label: "Maybe", value: maybe, color: "bg-yellow-100 text-yellow-700" },
    { label: "Declined", value: declined, color: "bg-red-100 text-red-700" },
    { label: "Pending", value: pending, color: "bg-gray-100 text-gray-700" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl p-4 text-center ${stat.color}`}
        >
          <div className="text-2xl font-bold">{stat.value}</div>
          <div className="text-sm font-medium">{stat.label}</div>
        </div>
      ))}
      {totalPlusOnes > 0 && (
        <div className="col-span-2 md:col-span-4 text-sm text-gray-500 text-center">
          + {totalPlusOnes} plus-one{totalPlusOnes !== 1 ? "s" : ""}
          {" "}({going + maybe + totalPlusOnes} total expected)
        </div>
      )}
    </div>
  );
}
