export const demoData = Object.freeze({
  summary: {
    availableMonth: 2483.5,
    totalCash: 18742.5,
    netWorth: 36420.8,
    incomeMonth: 5800,
    spendingMonth: 2622.45,
    reserves: 694,
    savingsRate: 21.4,
  },
  accounts: [
    { id: 'a1', name: 'Lohnkonto', provider: 'Hauptbank', type: 'Privatkonto', balance: 12413.75, change: 2430.0, icon: 'wallet' },
    { id: 'a2', name: 'Sparkonto', provider: 'Hauptbank', type: 'Sparkonto', balance: 5812.2, change: 250.0, icon: 'piggy-bank' },
    { id: 'a3', name: 'Bargeld', provider: 'Manuell', type: 'Bargeld', balance: 516.55, change: -35.0, icon: 'banknote' },
  ],
  upcoming: [
    { id: 'u1', title: 'Krankenkasse', meta: '30. September', amount: -420, state: 'Demnächst', icon: 'heart-pulse' },
    { id: 'u2', title: 'Miete', meta: '1. Oktober', amount: -1850, state: 'Geplant', icon: 'home' },
    { id: 'u3', title: 'Internet', meta: '3. Oktober', amount: -69.9, state: 'Geplant', icon: 'wifi' },
    { id: 'u4', title: 'Lohn', meta: '25. Oktober', amount: 5800, state: 'Erwartet', icon: 'arrow-down-left' },
  ],
  transactions: [
    { id: 't1', title: 'Coop', category: 'Lebensmittel', date: '28.09.2026', account: 'Lohnkonto', amount: -86.4, icon: 'basket' },
    { id: 't2', title: 'SBB Mobile', category: 'Mobilität', date: '27.09.2026', account: 'Lohnkonto', amount: -32.0, icon: 'train' },
    { id: 't3', title: 'Lohn', category: 'Einnahmen', date: '25.09.2026', account: 'Lohnkonto', amount: 5800, icon: 'arrow-down-left' },
    { id: 't4', title: 'Restaurant', category: 'Freizeit', date: '24.09.2026', account: 'Kreditkarte', amount: -74.5, icon: 'utensils' },
    { id: 't5', title: 'Swisscom', category: 'Kommunikation', date: '23.09.2026', account: 'Lohnkonto', amount: -119.9, icon: 'smartphone' },
    { id: 't6', title: 'Transfer Sparen', category: 'Umbuchung', date: '22.09.2026', account: 'Lohnkonto', amount: -250, icon: 'repeat' },
  ],
  budgets: [
    { name: 'Lebensmittel', spent: 612.4, limit: 850 },
    { name: 'Freizeit', spent: 388.2, limit: 500 },
    { name: 'Mobilität', spent: 276.8, limit: 450 },
    { name: 'Haushalt', spent: 198.1, limit: 350 },
  ],
  goals: [
    { name: 'Notgroschen', current: 7200, target: 12000, due: 'Dezember 2027' },
    { name: 'Ferien', current: 1850, target: 3500, due: 'Juni 2027' },
    { name: 'Neues Auto', current: 4300, target: 18000, due: '2029' },
  ],
  debts: [
    { name: 'Privatkredit', provider: 'Bank', outstanding: 8450, rate: 4.9, next: 355, due: '05.10.2026' },
    { name: 'Kreditkarte', provider: 'Card', outstanding: 1280.6, rate: 0, next: 1280.6, due: '12.10.2026' },
  ],
  wealthSeries: [21800, 23200, 24750, 24100, 26600, 28150, 29400, 31200, 30500, 32700, 34450, 36420.8],
  assets: [
    { label: 'Liquidität', value: 18742.5 },
    { label: 'Rücklagen', value: 9900 },
    { label: 'Sachwerte', value: 17408.9 },
  ],
  liabilities: 9630.6,
});
