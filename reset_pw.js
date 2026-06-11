const bcrypt = require('./node_modules/bcryptjs')
const { PrismaClient } = require('./node_modules/@prisma/client')

async function run() {
  const hash = await bcrypt.hash('75901530', 12)
  console.log('Hash généré:', hash)
  const prisma = new PrismaClient()
  await prisma.user.update({
    where: { email: 'mateocaestecker2022@gmail.com' },
    data: { password: hash },
  })
  const user = await prisma.user.findUnique({ where: { email: 'mateocaestecker2022@gmail.com' }, select: { password: true } })
  const ok = await bcrypt.compare('75901530', user.password)
  console.log('Updated:', 'mateocaestecker2022@gmail.com')
  console.log('Password valide:', ok)
  await prisma.$disconnect()
}
run().catch(console.error)
