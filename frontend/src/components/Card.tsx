import { Card as CardType } from "../store/gameStore";

interface CardProps {
  card: CardType;
  hidden?: boolean;
}

export default function Card({ card, hidden }: CardProps) {
  if (hidden || card.suit === "back") {
    return (
      <div className="w-16 h-24 bg-blue-800 border-2 border-blue-600 rounded-lg flex items-center justify-center">
        <div className="text-4xl">🂠</div>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const suitSymbol = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  }[card.suit];

  return (
    <div className="w-16 h-24 bg-white rounded-lg border-2 border-gray-300 p-2 flex flex-col justify-between">
      <div
        className={`text-xl font-bold ${isRed ? "text-red-600" : "text-black"}`}
      >
        {card.rank}
        <div className="text-2xl">{suitSymbol}</div>
      </div>
      <div
        className={`text-xl font-bold text-right ${
          isRed ? "text-red-600" : "text-black"
        }`}
      >
        {card.rank}
      </div>
    </div>
  );
}
