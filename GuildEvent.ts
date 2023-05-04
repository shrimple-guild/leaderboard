export class GuildEvent {
    name!: string
    intro!: string
    description!: string
    outro!: string
    icon!: string
    start!: number
    duration!: number
    metrics!: string[]

    private constructor() {}

    static from(json: any) {
      Object.assign(new GuildEvent(), json)
    }


}