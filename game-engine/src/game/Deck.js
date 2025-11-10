export class Deck {
  constructor(deckCount = 6) {
    this.cards = [];
    this.suits = ["hearts", "diamonds", "clubs", "spades"];
    this.ranks = [
      { rank: "A", value: 11 },
      { rank: "2", value: 2 },
      { rank: "3", value: 3 },
      { rank: "4", value: 4 },
      { rank: "5", value: 5 },
      { rank: "6", value: 6 },
      { rank: "7", value: 7 },
      { rank: "8", value: 8 },
      { rank: "9", value: 9 },
      { rank: "10", value: 10 },
      { rank: "J", value: 10 },
      { rank: "Q", value: 10 },
      { rank: "K", value: 10 },
    ];
    this.initialize(deckCount);
    this.shuffle();
  }

  /**
   * Inicializa el mazo con N barajas
   */
  initialize(deckCount) {
    this.cards = [];

    for (let d = 0; d < deckCount; d++) {
      for (const suit of this.suits) {
        for (const { rank, value } of this.ranks) {
          this.cards.push({ suit, rank, value });
        }
      }
    }
  }

  /**
   * Mezcla las cartas usando el algoritmo Fisher-Yates
   */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Reparte una carta del mazo
   */
  deal() {
    if (this.cards.length === 0) {
      return null;
    }
    return this.cards.pop();
  }

  /**
   * Obtiene el número de cartas restantes
   */
  getRemainingCards() {
    return this.cards.length;
  }

  /**
   * Verifica si es necesario mezclar de nuevo
   */
  needsShuffle() {
    // Mezclar cuando quedan menos del 25% de las cartas
    const totalCards = 52 * 6; // 6 mazos
    return this.cards.length < totalCards * 0.25;
  }
}

/**
 * Calcula el valor de una mano considerando los Ases
 */
export function calculateHandValue(cards) {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    value += card.value;
    if (card.rank === "A") {
      aces++;
    }
  }

  // Ajustar el valor de los Ases si la mano se pasa de 21
  while (value > 21 && aces > 0) {
    value -= 10; // Convertir un As de 11 a 1
    aces--;
  }

  return value;
}

/**
 * Verifica si una mano es Blackjack (21 con 2 cartas)
 */
export function isBlackjack(cards) {
  return cards.length === 2 && calculateHandValue(cards) === 21;
}

/**
 * Verifica si una mano está busted (más de 21)
 */
export function isBusted(cards) {
  return calculateHandValue(cards) > 21;
}
