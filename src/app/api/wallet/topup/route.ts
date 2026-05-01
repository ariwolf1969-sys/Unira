import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, description } = body;

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'userId y amount son requeridos (amount > 0)' },
        { status: 400 }
      );
    }

    // Get current balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const newBalance = user.walletBalance + amount;

    // Update user balance and create movement in a transaction
    const [updatedUser, movement] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { walletBalance: newBalance },
      }),
      prisma.walletMovement.create({
        data: {
          userId,
          type: 'topup',
          amount,
          description: description || 'Recarga',
          balance: newBalance,
        },
      }),
    ]);

    return NextResponse.json({
      balance: updatedUser.walletBalance,
      movement: {
        id: movement.id,
        type: movement.type,
        amount: movement.amount,
        description: movement.description,
        balance: movement.balance,
        date: movement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Topup error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
