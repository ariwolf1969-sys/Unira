import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ─── Knowledge base (simple in-memory FAQ; in production this would be a DB table) ──
// Editable by admin in a future iteration. For now, hardcoded baseline.

const KNOWLEDGE_BASE = `
TEYEVO es una app de transporte, delivery, servicios y pagos de la Cooperativa UNIRA, basada en Buenos Aires, Argentina.

Preguntas frecuentes:

1. ¿Cómo pido un viaje?
   Abrí la app, tocá "Pedir TEYEVO", ingresá origen y destino, elegí el tipo de vehículo y confirmá.

2. ¿Qué métodos de pago aceptan?
   Efectivo, billetera TEYEVO (carga previa con tarjeta/Mercado Pago/efectivo) y próximamente tarjeta de crédito/débito.

3. ¿Cómo recargo la billetera?
   Entrá a "Billetera" → "Recargar" → elegí monto y método.

4. ¿Cuánto cuesta un viaje?
   Se calcula con tarifa base + distancia + tiempo, según el tipo de vehículo. Moto: más económico. Auto premium: más caro.

5. Perdí un objeto en un viaje, ¿qué hago?
   Andá a "Objetos perdidos" en tu perfil, cargá la descripción y, si podés, asociá el viaje. El conductor lo verá.

6. ¿Cómo me hago conductor?
   Al registrarte, marcá la opción "Quiero ser conductor". Subí tu licencia y esperá la aprobación del admin.

7. ¿Cómo verifico mi cuenta?
   Necesitás verificar teléfono (OTP por SMS) y email (link por correo). Después, un admin aprueba tus documentos.

8. ¿Puedo tener descuentos?
   Sí: en tu cumpleaños te regalamos $1.000 en la billetera. También hay promociones por temporadas.

9. ¿Cómo contacto a un operador humano?
   Si la IA no resuelve tu consulta, tocá "Hablar con operador" y te derivaremos. Horario: L-V 9-18h.

10. ¿Dónde están mis viajes pasados?
    En "Actividad" (icono de reloj en la barra inferior). Tocá cualquier viaje para ver el recorrido en mapa y descargar comprobante.

11. ¿Puedo compartir mi viaje con un familiar?
    Sí, durante el viaje activo habrá un botón "Compartir viaje" que genera un enlace con seguimiento en tiempo real.

12. ¿Cómo cambio mi rol de pasajero a conductor?
    En tu perfil, tocá "Cambiar rol". Si ya estás verificado como conductor, podés alternar entre los dos modos.

13. ¿Qué hago si el conductor no llega?
    Esperá 5 minutos. Si no aparece, cancelá desde la app sin cargo. Para reclamos, usá el botón "Hablar con operador".

14. ¿Cómo califico al conductor?
    Al finalizar el viaje, dejá tu calificación con estrellas. Si fue 1 o 5 estrellas, se te pedirá un motivo. Las calificaciones son privadas por 7 días para evitar represalias.

15. ¿La app graba los viajes?
    Por defecto no. El usuario puede activar grabación de audio/video con consentimiento explícito al inicio del viaje.

16. ¿Qué zonas cubre TEYEVO?
    Por ahora CABA y Gran Buenos Aires. Próximamente Córdoba y Rosario.

17. ¿Cómo cancelo un viaje?
    Antes de que el conductor llegue: sin cargo. Después de que arrive: pequeña tarifa de espera.

18. ¿Puedo hacer múltiples paradas?
    Sí, hasta 4 paradas intermedias. Tocá "Agregar parada intermedia" al pedir el viaje.
`.trim();

const SYSTEM_PROMPT = `Sos el asistente virtual de TEYEVO, una app de transporte, delivery, servicios y pagos de la Cooperativa UNIRA (Buenos Aires, Argentina).

Respondé en español rioplatense, con tono cálido, conciso y práctico. Si la pregunta no está en tu knowledge base, ofrecé derivar a un operador humano.

Knowledge base:
${KNOWLEDGE_BASE}

Si la consulta es sobre algo que no está en la knowledge base, o si el usuario pide explícitamente hablar con una persona, respondé con el texto exacto:
[ESCALAR_HUMANO]
y luego una breve explicación de que vas a derivar la consulta a un operador.`;

// ─── POST /api/help-tickets ─────────────────────────────────────────────────

interface HelpRequestBody {
  userId: string;
  subject?: string;
  question: string;
  channel?: 'app' | 'telegram';
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HelpRequestBody;
    const { userId, question, subject, channel = 'app', history = [] } = body;

    if (!userId || !question) {
      return NextResponse.json(
        { error: 'userId y question son requeridos' },
        { status: 400 }
      );
    }

    // 1. Try LLM-based answer
    let aiAnswer = '';
    let escalated = false;

    try {
      // Dynamic import — z-ai-web-dev-sdk is server-only
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      // Build conversation: system → history → user question
      const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
        { role: 'assistant', content: SYSTEM_PROMPT },
        ...history.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: question },
      ];

      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });

      aiAnswer = completion.choices[0]?.message?.content?.trim() || '';
    } catch (llmErr) {
      console.warn('[help] LLM failed, using fallback:', llmErr);
      aiAnswer = [
        'Disculpá, no puedo responder en este momento.',
        'Probá de nuevo más tarde, o tocá "Hablar con operador" para asistencia humana.',
      ].join(' ');
    }

    // Check escalation signal
    if (aiAnswer.includes('[ESCALAR_HUMANO]')) {
      escalated = true;
      aiAnswer = aiAnswer
        .replace('[ESCALAR_HUMANO]', '')
        .trim();
      if (!aiAnswer) {
        aiAnswer = 'Voy a derivar tu consulta con un operador humano. Te contactaremos a la brevedad.';
      }
    }

    // 2. Persist the HelpTicket
    const ticket = await prisma.helpTicket.create({
      data: {
        userId,
        channel,
        subject: (subject || question.slice(0, 80)),
        question,
        aiAnswer,
        escalatedToHuman: escalated,
      },
    });

    return NextResponse.json({
      ticketId: ticket.id,
      answer: aiAnswer,
      escalated,
      knowledgeBase: KNOWLEDGE_BASE, // expose for transparency/debug
    });
  } catch (error) {
    console.error('Help ticket error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ─── GET /api/help-tickets?userId=... ───────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }
    const tickets = await prisma.helpTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Get help tickets error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
