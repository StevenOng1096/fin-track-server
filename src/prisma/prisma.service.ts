import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { disconnectPrisma, getPrismaClient } from './prisma-client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma = getPrismaClient();

  get user() {
    return this.prisma.user;
  }

  get session() {
    return this.prisma.session;
  }

  get account() {
    return this.prisma.account;
  }

  get wallet() {
    return this.prisma.wallet;
  }

  get walletBalance() {
    return this.prisma.walletBalance;
  }

  get transaction() {
    return this.prisma.transaction;
  }

  get transactionCategory() {
    return this.prisma.transactionCategory;
  }

  get transactionSubcategory() {
    return this.prisma.transactionSubcategory;
  }

  get recurringTransaction() {
    return this.prisma.recurringTransaction;
  }

  get recurringExecution() {
    return this.prisma.recurringExecution;
  }

  get asset() {
    return this.prisma.asset;
  }

  get assetTransaction() {
    return this.prisma.assetTransaction;
  }

  $transaction<T>(
    fn: (tx: PrismaClient) => Promise<T>,
    options?: Parameters<PrismaClient['$transaction']>[1],
  ): Promise<T> {
    return this.prisma.$transaction(fn, options);
  }

  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> {
    return this.prisma.$queryRaw(query, ...values);
  }

  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number> {
    return this.prisma.$executeRaw(query, ...values);
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await disconnectPrisma();
  }
}
