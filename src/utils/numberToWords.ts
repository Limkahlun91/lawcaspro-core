
export function numberToWords(amount: number): string {
  const units = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE']
  const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

  if (amount === 0) return 'ZERO RINGGIT MALAYSIA ONLY'

  const convertGroup = (n: number): string => {
    let str = ''
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' HUNDRED '
      n %= 100
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' '
      n %= 10
    }
    if (n >= 10) {
      str += teens[n - 10] + ' '
      n = 0
    }
    if (n > 0) {
      str += units[n] + ' '
    }
    return str.trim()
  }

  const whole = Math.floor(amount)
  const cents = Math.round((amount - whole) * 100)

  let words = ''
  
  if (whole > 0) {
    if (whole >= 1000000) {
      words += convertGroup(Math.floor(whole / 1000000)) + ' MILLION '
    }
    if ((whole % 1000000) >= 1000) {
      words += convertGroup(Math.floor((whole % 1000000) / 1000)) + ' THOUSAND '
    }
    if ((whole % 1000) > 0) {
      words += convertGroup(whole % 1000) + ' '
    }
    words = words.trim() + ' RINGGIT MALAYSIA'
  } else {
    words = 'ZERO RINGGIT MALAYSIA'
  }

  if (cents > 0) {
    words += ' AND ' + convertGroup(cents) + ' CENTS'
  }

  words += ' ONLY'

  return words.replace(/\s+/g, ' ').trim()
}
