import jetLogger from 'jet-logger';

export const getBroadcastCode = () => {
  return [0, 1, 2]
    .map(() => Math.random().toString(36).substring(2, 6))
    .join('-')
    .toLowerCase();
};

const makeJetLogger = (type: 'info' | 'err' | 'warn' | 'imp') => {
  return (...args: unknown[]): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _args: any = Array.from(args);

    const logMessage = _args
      .map((_: any) => (typeof _ === 'string' ? _ : _?.message || JSON.stringify(_, null, 4)))
      .join(' ');
    jetLogger[type](logMessage);
  };
};
export const logger = {
  log: makeJetLogger('info'),
  info: makeJetLogger('info'),
  error: makeJetLogger('err'),
  warn: makeJetLogger('warn'),
  debug: makeJetLogger('imp'),
  imp: makeJetLogger('imp'),
} as const;
