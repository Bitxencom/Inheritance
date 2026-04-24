import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { bsc, mainnet } from '@reown/appkit/networks';

console.log(!!WagmiAdapter, !!createAppKit, !!bsc);
