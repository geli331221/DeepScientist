import React from 'react'
import { Box, Text } from 'ink'
import { useTerminalSize } from '../hooks/useTerminalSize.js'

const COLORS = {
  blue: '#4796E4',
  sky: '#6E8CE8',
  violet: '#847ACE',
  rose: '#C3677F',
  gold: '#B69B4A',
}

const WORDMARK_LINES = [
  '  ____                  ____       _            _   _     _   ',
  ' |  _ \\  ___  ___ _ __ / ___|  ___(_) ___ _ __ | |_(_)___| |_ ',
  " | | | |/ _ \\/ _ \\ '_ \\\\___ \\ / __| |/ _ \\ '_ \\| __| / __| __|",
  ' | |_| |  __/  __/ |_) |___) | (__| |  __/ | | | |_| \\__ \\ |_ ',
  ' |____/ \\___|\\___| .__/|____/ \\___|_|\\___|_| |_|\\__|_|___/\\__|',
  '                 |_|                                          ',
]

const WORDMARK_COLORS = [
  COLORS.blue,
  COLORS.sky,
  COLORS.violet,
  COLORS.violet,
  COLORS.rose,
  COLORS.gold,
]

const IconMark: React.FC = () => (
  <Box flexDirection="column" marginRight={2}>
    <Text>
      <Text color={COLORS.gold}>     ✦</Text>
    </Text>
    <Text>
      <Text color={COLORS.blue}>  ╭──</Text>
      <Text color={COLORS.violet}>◌</Text>
      <Text color={COLORS.blue}>──╮</Text>
    </Text>
    <Text>
      <Text color={COLORS.violet}>◌ </Text>
      <Text color={COLORS.blue}>│ </Text>
      <Text color={COLORS.gold}>●</Text>
      <Text color={COLORS.blue}> │</Text>
      <Text color={COLORS.violet}> ◌</Text>
    </Text>
    <Text>
      <Text color={COLORS.blue}>  ╰──</Text>
      <Text color={COLORS.violet}>◌</Text>
      <Text color={COLORS.blue}>──╯</Text>
    </Text>
    <Text>
      <Text color={COLORS.gold}>     ✦</Text>
    </Text>
    <Text color={COLORS.gold}>  research orbit</Text>
  </Box>
)

const CompactMark: React.FC = () => (
  <Text>
    <Text color={COLORS.gold}>✦ </Text>
    <Text color={COLORS.blue}>DEEP</Text>
    <Text color={COLORS.violet}>SCIENT</Text>
    <Text color={COLORS.rose}>IST</Text>
  </Text>
)

export const Logo: React.FC = () => {
  const { columns } = useTerminalSize()

  if (columns < 120) {
    return (
      <Box flexDirection="column">
        <CompactMark />
      </Box>
    )
  }

  return (
    <Box flexDirection="row" alignItems="flex-start">
      <IconMark />
      <Box flexDirection="column">
        {WORDMARK_LINES.map((line, index) => (
          <Text key={line} color={WORDMARK_COLORS[index] || COLORS.blue}>
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
