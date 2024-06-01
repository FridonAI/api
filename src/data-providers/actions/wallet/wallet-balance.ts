import { HttpException } from '@nestjs/common';
import { InterfaceSnippet } from '../interface';
import { BalanceOperationType, BalanceType } from '../shared/types';
import { PublicKey } from '@metaplex-foundation/js';
import { Registry } from 'src/data-providers/registry';

type Request = {
  walletAddress: string;
  currency: string;
  operation: BalanceOperationType;
};

type Response = BalanceType[];

@Registry('wallet-balance')
export class WalletBalance extends InterfaceSnippet<Request, Response> {
  async execute(data: Request): Promise<Response> {
    const { walletAddress, currency } = data;
    try {
      new PublicKey(walletAddress);
    } catch (error) {
      throw new HttpException('Invalid wallet address', 403);
    }
    const balances: BalanceType[] = [];

    let mintAddress = currency
      ? await this.tools.convertSymbolToMintAddress(currency)
      : undefined;

    if (currency == 'all') {
      mintAddress = undefined;
    }

    // If mint address we need exact token balance, if no lets fetch all ones
    const tokenBalances = await this.walletFactory.getWalletBalances(
      walletAddress,
      await this.tools.getMintAddresses(),
      mintAddress ? [mintAddress] : [],
    );

    if (tokenBalances.length == 0) {
      if (mintAddress) {
        throw new HttpException(
          `${currency?.toUpperCase()} token account not found, you do not have this token in your wallet.`,
          404,
        );
      }

      throw new HttpException('Your Wallet balance is 0', 404);
    }

    balances.push(
      ...(await this.tools.convertTokenBalancesToBalances(tokenBalances)),
    );

    return balances;
  }
}
